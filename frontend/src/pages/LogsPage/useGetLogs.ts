import { useGetLogsLazyQuery } from '@graph/hooks'
import { LogEdge, PageInfo } from '@graph/schemas'
import moment from 'moment'
import { useEffect, useState } from 'react'

const FORMAT = 'YYYY-MM-DDTHH:mm:00.000000000Z'

export const useGetLogs = ({
	query,
	project_id,
	log_cursor,
	startDate,
	endDate,
}: {
	query: string
	project_id: string | undefined
	log_cursor: string | undefined
	startDate: Date
	endDate: Date
}) => {
	const [logEdges, setLogEdges] = useState<LogEdge[]>([])
	const [pageInfo, setPageInfo] = useState<PageInfo>({
		hasNextPage: false,
		hasPreviousPage: false,
		startCursor: '',
		endCursor: '',
	})

	const [getLogs, { loading: logsLoading, error: logsError, fetchMore }] =
		useGetLogsLazyQuery({
			variables: {
				project_id: project_id!,
				cursor: log_cursor,
				params: {
					query,
					date_range: {
						start_date: moment(startDate).format(FORMAT),
						end_date: moment(endDate).format(FORMAT),
					},
				},
			},
			fetchPolicy: 'no-cache',
		})

	useEffect(() => {
		getLogs().then((result) => {
			if (result.data?.logs) {
				setLogEdges(result.data.logs.edges)
				setPageInfo(result.data.logs.pageInfo)
			}
		})
	}, [project_id, query, startDate, endDate, getLogs, log_cursor])

	return {
		logEdges,
		pageInfo,
		loading: logsLoading,
		error: logsError,
		fetchMore,
	}
}
