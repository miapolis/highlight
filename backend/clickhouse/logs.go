package clickhouse

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	modelInputs "github.com/highlight-run/highlight/backend/private-graph/graph/model"
	"github.com/huandu/go-sqlbuilder"
	flat "github.com/nqd/flat"
	e "github.com/pkg/errors"
)

type LogRow struct {
	Timestamp          time.Time
	UUID               string
	TraceId            string
	SpanId             string
	TraceFlags         uint32
	SeverityText       string
	SeverityNumber     int32
	ServiceName        string
	Body               string
	ResourceAttributes map[string]string
	LogAttributes      map[string]string
	ProjectId          uint32
	SecureSessionId    string
}

func (logRow LogRow) Cursor() string {
	return encodeCursor(logRow.Timestamp, logRow.UUID)
}

func (client *Client) BatchWriteLogRows(ctx context.Context, logRows []*LogRow) error {
	batch, err := client.conn.PrepareBatch(ctx, "INSERT INTO logs")

	if err != nil {
		return e.Wrap(err, "failed to create logs batch")
	}

	for _, logRow := range logRows {
		if len(logRow.UUID) == 0 {
			logRow.UUID = uuid.New().String()
		}
		err = batch.AppendStruct(logRow)
		if err != nil {
			return err
		}
	}
	return batch.Send()
}

const Limit int = 100

type Pagination struct {
	After          *string
	AfterOrEqualTo *string // currently only used internally
	Before         *string
	WindowAround   *string
}

func (client *Client) ReadLogs(ctx context.Context, projectID int, params modelInputs.LogsParamsInput, pagination Pagination) (*modelInputs.LogsConnection, error) {
	var err error
	var sql string
	var args []interface{}
	selectStr := "Timestamp, UUID, SeverityText, Body, LogAttributes"
	orderBy := "Timestamp DESC, UUID DESC"

	if pagination.WindowAround != nil && len(*pagination.WindowAround) > 1 {
		// Create a "window" around the cursor
		// https://stackoverflow.com/a/71738696

		sb1, err := makeSelectBuilder(selectStr, projectID, params, Pagination{
			Before: pagination.WindowAround,
		})
		if err != nil {
			return nil, err
		}
		sb1.OrderBy(orderBy).Limit(Limit/2 + 1)

		sb2, err := makeSelectBuilder(selectStr, projectID, params, Pagination{
			AfterOrEqualTo: pagination.WindowAround,
		})
		if err != nil {
			return nil, err
		}
		sb2.OrderBy(orderBy).Limit(Limit/2 + 1 + 1)

		sb := sqlbuilder.NewSelectBuilder()
		ub := sqlbuilder.UnionAll(sb1, sb2)
		sb.Select(selectStr).From(sb.BuilderAs(ub, "logs_window"))

		sql, args = sb.Build()
	} else {
		var sb *sqlbuilder.SelectBuilder
		sb, err = makeSelectBuilder(selectStr, projectID, params, pagination)
		if err != nil {
			return nil, err
		}
		sb.OrderBy(orderBy).Limit(Limit + 1)
		sql, args = sb.Build()
	}

	rows, err := client.conn.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}

	logs := []*modelInputs.LogEdge{}

	for rows.Next() {
		var (
			Timestamp     time.Time
			UUID          string
			SeverityText  string
			Body          string
			LogAttributes map[string]string
		)
		if err := rows.Scan(&Timestamp, &UUID, &SeverityText, &Body, &LogAttributes); err != nil {
			return nil, err
		}

		logs = append(logs, &modelInputs.LogEdge{
			Cursor: encodeCursor(Timestamp, UUID),
			Node: &modelInputs.Log{
				Timestamp:     Timestamp,
				SeverityText:  makeSeverityText(SeverityText),
				Body:          Body,
				LogAttributes: expandJSON(LogAttributes),
			},
		})
	}
	rows.Close()

	return getLogsConnection(logs, pagination), rows.Err()
}

func (client *Client) ReadLogsTotalCount(ctx context.Context, projectID int, params modelInputs.LogsParamsInput) (uint64, error) {
	sb, err := makeSelectBuilder("COUNT(*)", projectID, params, Pagination{})
	if err != nil {
		return 0, err
	}

	sql, args := sb.Build()

	var count uint64
	err = client.conn.QueryRow(ctx, sql, args...).Scan(&count)

	return count, err
}

func (client *Client) LogsKeys(ctx context.Context, projectID int) ([]*modelInputs.LogKey, error) {
	sb := sqlbuilder.NewSelectBuilder()

	sb.Select("arrayJoin(LogAttributes.keys) as key, count() as cnt").
		From("logs").
		Where(sb.Equal("ProjectId", projectID)).
		GroupBy("key").
		OrderBy("cnt DESC").
		Limit(50)

	sql, args := sb.Build()

	rows, err := client.conn.Query(ctx, sql, args...)

	if err != nil {
		return nil, err
	}

	keys := []*modelInputs.LogKey{}
	for rows.Next() {
		var (
			Key   string
			Count uint64
		)
		if err := rows.Scan(&Key, &Count); err != nil {
			return nil, err
		}

		keys = append(keys, &modelInputs.LogKey{
			Name: Key,
			Type: modelInputs.LogKeyTypeString, // For now, assume everything is a string
		})
	}

	rows.Close()
	return keys, rows.Err()

}

func (client *Client) LogsKeyValues(ctx context.Context, projectID int, keyName string) ([]string, error) {
	sb := sqlbuilder.NewSelectBuilder()
	sb.Select("LogAttributes [" + sb.Var(keyName) + "] as value, count() as cnt").
		From("logs").
		Where(sb.Equal("ProjectId", projectID)).
		Where("mapContains(LogAttributes, " + sb.Var(keyName) + ")").
		GroupBy("value").
		OrderBy("cnt DESC").
		Limit(50)

	sql, args := sb.Build()

	rows, err := client.conn.Query(ctx, sql, args...)

	if err != nil {
		return nil, err
	}

	values := []string{}
	for rows.Next() {
		var (
			Value string
			Count uint64
		)
		if err := rows.Scan(&Value, &Count); err != nil {
			return nil, err
		}

		values = append(values, Value)
	}

	rows.Close()

	return values, rows.Err()
}

func makeSeverityText(severityText string) modelInputs.SeverityText {
	switch strings.ToLower(severityText) {
	case "trace":
		{
			return modelInputs.SeverityTextTrace

		}
	case "debug":
		{
			return modelInputs.SeverityTextDebug

		}
	case "info":
		{
			return modelInputs.SeverityTextInfo

		}
	case "warn":
		{
			return modelInputs.SeverityTextWarn
		}
	case "error":
		{
			return modelInputs.SeverityTextError
		}

	case "fatal":
		{
			return modelInputs.SeverityTextFatal
		}

	default:
		return modelInputs.SeverityTextInfo
	}
}

func makeSelectBuilder(selectStr string, projectID int, params modelInputs.LogsParamsInput, pagination Pagination) (*sqlbuilder.SelectBuilder, error) {
	sb := sqlbuilder.NewSelectBuilder()
	sb.Select(selectStr).
		From("logs").
		Where(sb.Equal("ProjectId", projectID))

	if pagination.After != nil && len(*pagination.After) > 1 {
		timestamp, uuid, err := decodeCursor(*pagination.After)
		if err != nil {
			return nil, err
		}

		// See https://dba.stackexchange.com/a/206811
		sb.Where(sb.LessEqualThan("toUInt64(toDateTime(Timestamp))", uint64(timestamp.Unix()))).
			Where(
				sb.Or(
					sb.LessThan("toUInt64(toDateTime(Timestamp))", uint64(timestamp.Unix())),
					sb.LessThan("UUID", uuid),
				),
			)
	} else if pagination.AfterOrEqualTo != nil && len(*pagination.AfterOrEqualTo) > 1 {
		timestamp, uuid, err := decodeCursor(*pagination.AfterOrEqualTo)
		if err != nil {
			return nil, err
		}

		sb.Where(sb.LessEqualThan("toUInt64(toDateTime(Timestamp))", uint64(timestamp.Unix()))).
			Where(
				sb.Or(
					sb.LessEqualThan("toUInt64(toDateTime(Timestamp))", uint64(timestamp.Unix())),
					sb.LessEqualThan("UUID", uuid),
				),
			)
	} else if pagination.Before != nil && len(*pagination.Before) > 1 {
		timestamp, uuid, err := decodeCursor(*pagination.Before)
		if err != nil {
			return nil, err
		}

		sb.Where(sb.GreaterEqualThan("toUInt64(toDateTime(Timestamp))", uint64(timestamp.Unix()))).
			Where(
				sb.Or(
					sb.GreaterThan("toUInt64(toDateTime(Timestamp))", uint64(timestamp.Unix())),
					sb.GreaterThan("UUID", uuid),
				),
			)
	} else {
		sb.Where(sb.LessEqualThan("toUInt64(toDateTime(Timestamp))", uint64(params.DateRange.EndDate.Unix()))).
			Where(sb.GreaterEqualThan("toUInt64(toDateTime(Timestamp))", uint64(params.DateRange.StartDate.Unix())))
	}

	filters := makeFilters(params.Query)

	if len(filters.body) > 0 {
		sb.Where("Body ILIKE" + sb.Var(filters.body))
	}

	for key, value := range filters.attributes {
		column := fmt.Sprintf("LogAttributes['%s']", key)
		if strings.Contains(value, "%") {
			sb.Where(sb.Like(column, value))

		} else {
			sb.Where(sb.Equal(column, value))
		}
	}

	return sb, nil
}

type filters struct {
	body       string
	attributes map[string]string
}

func makeFilters(query string) filters {
	filters := filters{
		body:       "",
		attributes: make(map[string]string),
	}

	queries := splitQuery(query)

	for _, q := range queries {
		parts := strings.Split(q, ":")

		if len(parts) == 1 && len(parts[0]) > 0 {
			body := parts[0]
			if strings.Contains(body, "*") {
				body = strings.ReplaceAll(body, "*", "%")
			}
			filters.body = filters.body + body
		} else if len(parts) == 2 {
			wildcardValue := strings.ReplaceAll(parts[1], "*", "%")
			filters.attributes[parts[0]] = wildcardValue
		}
	}

	if len(filters.body) > 0 && !strings.Contains(filters.body, "%") {
		filters.body = "%" + filters.body + "%"
	}

	return filters
}

// Splits the query by spaces _unless_ it is quoted
// "some thing" => ["some", "thing"]
// "some thing 'spaced string' else" => ["some", "thing", "spaced string", "else"]
func splitQuery(query string) []string {
	var result []string
	inquote := false
	i := 0
	for j, c := range query {
		if c == '"' {
			inquote = !inquote
		} else if c == ' ' && !inquote {
			result = append(result, unquoteAndTrim(query[i:j]))
			i = j + 1
		}
	}
	return append(result, unquoteAndTrim(query[i:]))
}

func unquoteAndTrim(s string) string {
	return strings.ReplaceAll(strings.Trim(s, " "), `"`, "")
}

func expandJSON(logAttributes map[string]string) map[string]interface{} {
	gqlLogAttributes := make(map[string]interface{}, len(logAttributes))
	for i, v := range logAttributes {
		gqlLogAttributes[i] = v
	}

	out, err := flat.Unflatten(gqlLogAttributes, nil)
	if err != nil {
		return gqlLogAttributes
	}

	return out
}
