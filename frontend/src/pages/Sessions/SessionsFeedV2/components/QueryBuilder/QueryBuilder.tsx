import Button from '@components/Button/Button/Button';
import InfoTooltip from '@components/InfoTooltip/InfoTooltip';
import Popover from '@components/Popover/Popover';
import { Field } from '@graph/schemas';
import SvgXIcon from '@icons/XIcon';
import { useSearchContext } from '@pages/Sessions/SearchContext/SearchContext';
import { SharedSelectStyleProps } from '@pages/Sessions/SearchInputs/SearchInputUtil';
import { DateInput } from '@pages/Sessions/SessionsFeedV2/components/QueryBuilder/components/DateInput';
import { LengthInput } from '@pages/Sessions/SessionsFeedV2/components/QueryBuilder/components/LengthInput';
import { useParams } from '@util/react-router/useParams';
import { Checkbox } from 'antd';
import classNames from 'classnames';
import moment from 'moment';
import React, { useEffect, useState } from 'react';
import { components } from 'react-select';
import AsyncSelect from 'react-select/async';
import AsyncCreatableSelect from 'react-select/async-creatable';
import { Styles } from 'react-select/src/styles';
import { OptionTypeBase } from 'react-select/src/types';
import { useToggle } from 'react-use';

import {
    useGetAppVersionsQuery,
    useGetFieldsOpensearchQuery,
    useGetFieldTypesQuery,
} from '../../../../../graph/generated/hooks';
import styles from './QueryBuilder.module.scss';

interface RuleProps {
    field: SelectOption | undefined;
    op: Operator | undefined;
    val: MultiselectOption | undefined;
}

interface SelectOption {
    kind: 'single';
    label: string;
    value: string;
}
interface MultiselectOption {
    kind: 'multi';
    options: readonly {
        label: string;
        value: string;
    }[];
}

type OnChangeInput = SelectOption | MultiselectOption | undefined;
type OnChange = (val: OnChangeInput) => void;
type LoadOptions = (input: string, callback: any) => Promise<any>;

interface RuleFuncs {
    onChangeKey: OnChange;
    getKeyOptions: LoadOptions;
    onChangeOperator: OnChange;
    getOperatorOptions: LoadOptions;
    onChangeValue: OnChange;
    getValueOptions: LoadOptions;
    onRemove: () => void;
}

type PopoutType =
    | 'select'
    | 'multiselect'
    | 'creatable'
    | 'date_range'
    | 'range';
interface PopoutProps {
    type: PopoutType;
    value: OnChangeInput;
    onChange: OnChange;
    loadOptions: LoadOptions;
}

interface SetVisible {
    setVisible: (val: boolean) => void;
}

const TOOLTIP_MESSAGE =
    'This property was automatically collected by Highlight';

const styleProps: Styles<{ label: string; value: string }, false> = {
    ...SharedSelectStyleProps,
    option: (provided, { isFocused }) => ({
        ...provided,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        direction: 'ltr',
        textAlign: 'left',
        padding: '8px 12px',
        fontSize: '12px',
        color: 'var(--color-text-primary)',
        backgroundColor: isFocused ? 'var(--color-gray-200)' : 'none',
        '&:active': {
            backgroundColor: 'var(--color-gray-200)',
        },
    }),
    menuList: (provided) => ({
        ...provided,
        scrollbarWidth: 'none',
        padding: '0',
        '&::-webkit-scrollbar': {
            display: 'none',
        },
    }),
    control: (provided) => ({
        ...provided,
        border: '0',
        boxShadow: '0',
        fontSize: '12px',
        background: 'none',
        'border-radius': '0',
        'border-bottom': '1px solid var(--color-gray-300)',
        '&:hover': {
            'border-bottom': '1px solid var(--color-gray-300)',
        },
    }),
    valueContainer: (provided) => ({
        ...provided,
        padding: '8px 12px',
    }),
    noOptionsMessage: (provided) => ({
        ...provided,
        fontSize: '12px',
    }),
};

const getMultiselectOption = (props: any) => {
    const {
        data: { data },
        label,
        value,
        isSelected,
        selectOption,
    } = props;

    return (
        <div>
            <components.Option {...props}>
                <div className={styles.optionLabelContainer}>
                    <Checkbox
                        className={styles.optionCheckbox}
                        checked={isSelected}
                        onChange={() => {
                            selectOption({
                                label: label,
                                value: value,
                                data: { fromCheckbox: true },
                            });
                        }}
                    ></Checkbox>

                    <div className={styles.optionLabelName}>
                        {data?.nameLabel ? data.nameLabel : label}
                    </div>
                </div>
            </components.Option>
        </div>
    );
};

const getOption = (props: any) => {
    const { label, value } = props;
    const type = getType(value);
    const nameLabel = getNameLabel(label);
    const typeLabel = getTypeLabel(value);

    return (
        <div>
            <components.Option {...props}>
                <div className={styles.optionLabelContainer}>
                    {!!typeLabel && (
                        <div className={styles.labelTypeContainer}>
                            <div className={styles.optionLabelType}>
                                {typeLabel}
                            </div>
                        </div>
                    )}
                    <div className={styles.optionLabelName}>{nameLabel}</div>
                    {(type === 'session' ||
                        type === CUSTOM_TYPE ||
                        value === 'user_identifier') && (
                        <InfoTooltip
                            title={TOOLTIP_MESSAGE}
                            size="medium"
                            hideArrow
                            placement="right"
                            className={styles.optionTooltip}
                        />
                    )}
                </div>
            </components.Option>
        </div>
    );
};

const PopoutContent = ({
    value,
    onChange,
    loadOptions,
    setVisible,
    type,
    ...props
}: PopoutProps & SetVisible & OptionTypeBase) => {
    switch (type) {
        case 'select':
            return (
                <AsyncSelect
                    autoFocus
                    openMenuOnFocus
                    value={value?.kind === 'single' ? value : null}
                    styles={styleProps}
                    loadOptions={loadOptions}
                    defaultOptions
                    menuIsOpen
                    controlShouldRenderValue={false}
                    hideSelectedOptions={false}
                    isClearable={false}
                    components={{
                        DropdownIndicator: () => null,
                        IndicatorSeparator: () => null,
                        Menu: (props) => {
                            return (
                                <components.MenuList
                                    className={styles.menuListContainer}
                                    maxHeight={400}
                                    {...props}
                                ></components.MenuList>
                            );
                        },
                        Option: getOption,
                    }}
                    onChange={(item) => {
                        onChange(
                            !!item ? { kind: 'single', ...item } : undefined
                        );
                        setVisible(false);
                    }}
                    onBlur={() => setVisible(false)}
                    {...props}
                />
            );
        case 'multiselect':
            return (
                <AsyncSelect
                    autoFocus
                    openMenuOnFocus
                    isMulti
                    value={value?.kind === 'multi' ? value.options : null}
                    styles={styleProps}
                    loadOptions={loadOptions}
                    defaultOptions
                    menuIsOpen
                    controlShouldRenderValue={false}
                    hideSelectedOptions={false}
                    isClearable={false}
                    components={{
                        DropdownIndicator: () => null,
                        IndicatorSeparator: () => null,
                        Menu: (props) => {
                            return (
                                <components.MenuList
                                    className={styles.menuListContainer}
                                    maxHeight={400}
                                    {...props}
                                ></components.MenuList>
                            );
                        },
                        Option: getMultiselectOption,
                    }}
                    onChange={(item) => {
                        onChange(
                            !!item
                                ? {
                                      kind: 'multi',
                                      options: item as readonly {
                                          label: string;
                                          value: string;
                                      }[],
                                  }
                                : undefined
                        );
                        if (value === undefined) {
                            setVisible(false);
                        }
                    }}
                    onBlur={() => setVisible(false)}
                    {...props}
                />
            );
        case 'creatable':
            return (
                <AsyncCreatableSelect
                    autoFocus
                    openMenuOnFocus
                    isMulti
                    value={value?.kind === 'multi' ? value.options : null}
                    styles={styleProps}
                    loadOptions={loadOptions}
                    defaultOptions
                    menuIsOpen
                    controlShouldRenderValue={false}
                    hideSelectedOptions={false}
                    isClearable={false}
                    components={{
                        DropdownIndicator: () => null,
                        IndicatorSeparator: () => null,
                        Menu: (props) => {
                            return (
                                <components.MenuList
                                    className={styles.menuListContainer}
                                    maxHeight={400}
                                    {...props}
                                ></components.MenuList>
                            );
                        },
                        Option: getMultiselectOption,
                    }}
                    onChange={(item) => {
                        onChange(
                            !!item
                                ? {
                                      kind: 'multi',
                                      options: item as readonly {
                                          label: string;
                                          value: string;
                                      }[],
                                  }
                                : undefined
                        );
                        if (value === undefined) {
                            setVisible(false);
                        }
                    }}
                    onBlur={() => setVisible(false)}
                    formatCreateLabel={(label) => label}
                    createOptionPosition="first"
                    allowCreateWhileLoading={false}
                    {...props}
                />
            );
        case 'date_range':
            return (
                <DateInput
                    startDate={
                        value?.kind === 'multi'
                            ? new Date(value.options[0]?.value.split('_')[0])
                            : undefined
                    }
                    endDate={
                        value?.kind === 'multi'
                            ? new Date(value.options[0]?.value.split('_')[1])
                            : undefined
                    }
                    onChange={(start, end) => {
                        const startStr = moment(start).format('MMM D');
                        const endStr = moment(end).format('MMM D');
                        const startIso = moment(start).toISOString();
                        const endIso = moment(end).toISOString();
                        onChange({
                            kind: 'multi',
                            options: [
                                {
                                    label: `${startStr} and ${endStr}`,
                                    value: `${startIso}_${endIso}`,
                                },
                            ],
                        });
                        setVisible(false);
                    }}
                    setVisible={setVisible}
                />
            );
        case 'range':
            return (
                <LengthInput
                    start={
                        value?.kind === 'multi'
                            ? Number(value.options[0]?.value.split('_')[0])
                            : 0
                    }
                    end={
                        value?.kind === 'multi'
                            ? Number(value.options[0]?.value.split('_')[1])
                            : 60
                    }
                    onChange={(start, end) => {
                        const ints =
                            Number.isInteger(start) && Number.isInteger(end);
                        const label = ints
                            ? `${start} and ${end} minutes`
                            : `${start * 60} and ${end * 60} seconds`;

                        onChange({
                            kind: 'multi',
                            options: [
                                {
                                    label: label,
                                    value: `${start}_${end}`,
                                },
                            ],
                        });
                        setVisible(false);
                    }}
                    setVisible={setVisible}
                />
            );
    }
};

const SelectPopout = ({ value, ...props }: PopoutProps) => {
    // Visible by default if no value yet
    const [visible, setVisible] = useState(!value);
    const onSetVisible = (val: boolean) => {
        setVisible(val);
    };

    const invalid =
        value === undefined ||
        (value?.kind === 'multi' && value.options.length === 0);

    return (
        <Popover
            isList
            content={
                <PopoutContent
                    value={value}
                    setVisible={onSetVisible}
                    {...props}
                    onBlur={() => onSetVisible(false)}
                />
            }
            placement="bottomLeft"
            contentContainerClassName={styles.contentContainer}
            popoverClassName={styles.popoverContainer}
            visible={visible}
            destroyTooltipOnHide
        >
            <Button
                type="text"
                trackingId={`SessionsQuerySelect`}
                className={classNames(styles.ruleItem, {
                    [styles.invalid]: invalid,
                })}
                onClick={() => onSetVisible(true)}
            >
                {invalid && '--'}
                {value?.kind === 'single' && getNameLabel(value.label)}
                {value?.kind === 'multi' &&
                    value.options.length > 1 &&
                    `${value.options.length} selections`}
                {value?.kind === 'multi' &&
                    value.options.length === 1 &&
                    value.options[0].label}
            </Button>
        </Popover>
    );
};

const getPopoutType = (op: Operator | undefined): PopoutType => {
    switch (op) {
        case 'contains':
        case 'not_contains':
        case 'matches':
        case 'not_matches':
            return 'creatable';
        case 'between_date':
            return 'date_range';
        case 'between':
            return 'range';
        default:
            return 'multiselect';
    }
};

const QueryRule = ({
    rule,
    onChangeKey,
    getKeyOptions,
    onChangeOperator,
    getOperatorOptions,
    onChangeValue,
    getValueOptions,
    onRemove,
}: { rule: RuleProps } & RuleFuncs) => {
    return (
        <div className={styles.ruleContainer}>
            <SelectPopout
                value={rule.field}
                onChange={onChangeKey}
                loadOptions={getKeyOptions}
                type="select"
            />
            <SelectPopout
                value={getOperator(rule.op, rule.val)}
                onChange={onChangeOperator}
                loadOptions={getOperatorOptions}
                type="select"
            />
            {!!rule.op && hasArguments(rule.op) && (
                <SelectPopout
                    value={rule.val}
                    onChange={onChangeValue}
                    loadOptions={getValueOptions}
                    type={getPopoutType(rule.op)}
                />
            )}
            <Button
                trackingId="SessionsQueryRemoveRule"
                className={styles.ruleItem}
                onClick={() => {
                    onRemove();
                }}
            >
                <SvgXIcon />
            </Button>
        </div>
    );
};

const hasArguments = (op: Operator): boolean =>
    !['exists', 'not_exists'].includes(op);

const isNegative = (op: Operator): boolean =>
    [
        'is_not',
        'not_contains',
        'not_exists',
        'not_between',
        'not_between_date',
        'not_matches',
    ].includes(op);

const LABEL_MAP_SINGLE: { [K in Operator]: string } = {
    is: 'is',
    is_not: 'is not',
    contains: 'contains',
    not_contains: 'does not contain',
    exists: 'exists',
    not_exists: 'does not exist',
    between: 'is between',
    not_between: 'is not between',
    between_date: 'is between',
    not_between_date: 'is not between',
    matches: 'matches',
    not_matches: 'does not match',
};

const LABEL_MAP_MULTI: { [K in Operator]: string } = {
    is: 'is any of',
    is_not: 'is not any of',
    contains: 'contains any of',
    not_contains: 'does not contain any of',
    exists: 'exists',
    not_exists: 'does not exist',
    between: 'is between',
    not_between: 'is not between',
    between_date: 'is between',
    not_between_date: 'is not between',
    matches: 'matches any of',
    not_matches: 'does not match any of',
};

const NEGATION_MAP: { [K in Operator]: Operator } = {
    is: 'is_not',
    is_not: 'is',
    contains: 'not_contains',
    not_contains: 'contains',
    exists: 'not_exists',
    not_exists: 'exists',
    between: 'not_between',
    not_between: 'between',
    between_date: 'not_between_date',
    not_between_date: 'between_date',
    matches: 'not_matches',
    not_matches: 'matches',
};

type Operator =
    | 'is'
    | 'is_not'
    | 'contains'
    | 'not_contains'
    | 'exists'
    | 'not_exists'
    | 'between'
    | 'not_between'
    | 'between_date'
    | 'not_between_date'
    | 'matches'
    | 'not_matches';

const OPERATORS: Operator[] = [
    'is',
    'is_not',
    'contains',
    'not_contains',
    'exists',
    'not_exists',
    'matches',
    'not_matches',
];

const RANGE_OPERATORS: Operator[] = ['between', 'not_between'];

const DATE_OPERATORS: Operator[] = ['between_date', 'not_between_date'];

const LABEL_MAP: { [key: string]: string } = {
    referrer: 'Referrer',
    os_name: 'Operating System',
    active_length: 'Length',
    app_version: 'App Version',
    browser_name: 'Browser',
    'visited-url': 'Visited URL',
    created_at: 'Date',
    device_id: 'Device ID',
    os_version: 'OS Version',
    browser_version: 'Browser Version',
    environment: 'Environment',
    processed: 'Status',
    viewed: 'Viewed',
    first_time: 'First Time',
    starred: 'Starred',
    identifier: 'Identifier',
    reload: 'Reloaded',
};

const getOperator = (
    op: Operator | undefined,
    val: OnChangeInput
): SelectOption | undefined => {
    if (!op) {
        return undefined;
    }

    const label = (isSingle(val) ? LABEL_MAP_SINGLE : LABEL_MAP_MULTI)[op];
    return {
        kind: 'single',
        value: op,
        label,
    };
};

const isSingle = (val: OnChangeInput) =>
    !(val?.kind === 'multi' && val.options.length > 1);

const CUSTOM_TYPE = 'custom';

const parseInner = (field: SelectOption, op: Operator, value?: string): any => {
    if (getType(field.value) === CUSTOM_TYPE) {
        const name = field.label;
        const isKeyword = !(getCustomFieldOptions(field)?.type !== 'text');
        switch (op) {
            case 'is':
                return {
                    term: { [`${name}${isKeyword ? '.keyword' : ''}`]: value },
                };
            case 'contains':
                return {
                    wildcard: {
                        [`${name}${isKeyword ? '.keyword' : ''}`]: `*${value}*`,
                    },
                };
            case 'matches':
                return {
                    regexp: {
                        [`${name}${isKeyword ? '.keyword' : ''}`]: value,
                    },
                };
            case 'exists':
                return { exists: { field: name } };
            case 'between_date':
                return {
                    range: {
                        [name]: {
                            gte: value?.split('_')[0],
                            lte: value?.split('_')[1],
                        },
                    },
                };
            case 'between':
                return {
                    range: {
                        [name]: {
                            gte: Number(value?.split('_')[0]) * 60 * 1000,
                            ...(Number(value?.split('_')[1]) === 60
                                ? null
                                : {
                                      lte:
                                          Number(value?.split('_')[1]) *
                                          60 *
                                          1000,
                                  }),
                        },
                    },
                };
        }
    } else {
        switch (op) {
            case 'is':
                return {
                    term: { 'fields.KeyValue': `${field.value}_${value}` },
                };
            case 'contains':
                return {
                    wildcard: {
                        'fields.KeyValue': `${field.value}_*${value}*`,
                    },
                };
            case 'matches':
                return {
                    regexp: {
                        'fields.KeyValue': `${field.value}_${value}`,
                    },
                };
            case 'exists':
                return { term: { 'fields.Key': field.value } };
        }
    }
};

const parseRuleImpl = (
    field: SelectOption,
    op: Operator,
    multiValue: MultiselectOption
): any => {
    if (isNegative(op)) {
        return {
            bool: {
                must_not: {
                    ...parseRuleImpl(field, NEGATION_MAP[op], multiValue),
                },
            },
        };
    } else if (hasArguments(op)) {
        return {
            bool: {
                should: multiValue.options.map(({ value }) =>
                    parseInner(field, op, value)
                ),
            },
        };
    } else {
        return parseInner(field, op);
    }
};

const parseRule = (rule: RuleProps): any => {
    const field = rule.field!;
    const multiValue = rule.val!;
    const op = rule.op!;

    return parseRuleImpl(field, op, multiValue);
};

const parseGroup = (isAnd: boolean, rules: RuleProps[]): any => ({
    bool: {
        [isAnd ? 'must' : 'should']: rules.map((rule) => parseRule(rule)),
    },
});

interface FieldOptions {
    operators?: Operator[];
    type?: string;
}

interface CustomField {
    options?: FieldOptions;
}

const CUSTOM_FIELDS: (CustomField & Pick<Field, 'type' | 'name'>)[] = [
    {
        type: CUSTOM_TYPE,
        name: 'app_version',
        options: {
            type: 'text',
        },
    },
    {
        type: CUSTOM_TYPE,
        name: 'created_at',
        options: {
            operators: DATE_OPERATORS,
            type: 'date',
        },
    },
    {
        type: CUSTOM_TYPE,
        name: 'active_length',
        options: {
            operators: RANGE_OPERATORS,
            type: 'long',
        },
    },
    {
        type: CUSTOM_TYPE,
        name: 'viewed',
        options: {
            type: 'boolean',
        },
    },
    {
        type: CUSTOM_TYPE,
        name: 'processed',
        options: {
            type: 'boolean',
        },
    },
    {
        type: CUSTOM_TYPE,
        name: 'first_time',
        options: {
            type: 'boolean',
        },
    },
    {
        type: CUSTOM_TYPE,
        name: 'starred',
        options: {
            type: 'boolean',
        },
    },
];

const toJSON = (rules: RuleProps[]): any => {
    const ruleGroups = rules
        .map((rule) => {
            if (!rule.field || !rule.op || !rule.val) {
                return undefined;
            }

            return [
                rule.field.value,
                rule.op,
                rule.val.options.map((op) => {
                    if (op.value === op.label) {
                        return op.value;
                    } else {
                        return {
                            l: op.label,
                            v: op.value,
                        };
                    }
                }),
            ];
        })
        .filter((ruleGroup) => !!ruleGroup);

    return ruleGroups;
};

const fromJSON = (ruleGroups: any): RuleProps[] => {
    const rules = ruleGroups.map((group: any) => {
        const fieldVal = group[0];
        const opVal = group[1];
        const vals = group[2];

        return {
            field: {
                kind: 'single',
                label: getName(fieldVal),
                value: fieldVal,
            },
            op: opVal as Operator,
            val: {
                kind: 'multi',
                options: vals.map((val: any) => {
                    if (val.v && val.l) {
                        return {
                            value: val.v,
                            label: val.l,
                        };
                    }
                    return {
                        label: val,
                        value: val,
                    };
                }),
            },
        };
    });

    return rules;
};

const isComplete = (rule: RuleProps) =>
    rule.field !== undefined &&
    rule.op !== undefined &&
    (!hasArguments(rule.op) ||
        (rule.val !== undefined && rule.val.options.length !== 0));

const getDefaultOperator = (field: SelectOption | undefined) =>
    ((field && getCustomFieldOptions(field)?.operators) ?? OPERATORS)[0];

const getNameLabel = (label: string) => LABEL_MAP[label] ?? label;

const getTypeLabel = (value: string) => {
    const type = getType(value);
    const mapped = type === CUSTOM_TYPE ? 'session' : type;
    if (!!mapped && ['track', 'user', 'session'].includes(mapped)) {
        return mapped;
    }
    return undefined;
};

const getType = (value: string) => {
    return value.split('_')[0];
};

const getName = (value: string) => {
    const [, ...rest] = value.split('_');
    return rest.join('_');
};

const getCustomFieldOptions = (field: SelectOption | undefined) => {
    if (!field) {
        return undefined;
    }

    const type = getType(field.value);
    if (type !== CUSTOM_TYPE) {
        return undefined;
    }

    return CUSTOM_FIELDS.find((f) => f.name === field.label)?.options;
};

const QueryBuilder = () => {
    const { project_id } = useParams<{
        project_id: string;
    }>();

    const {
        setSearchQuery,
        queryBuilderState,
        setQueryBuilderState,
    } = useSearchContext();

    const { data: fieldData } = useGetFieldTypesQuery({
        variables: { project_id },
    });

    const { refetch: fetchFields } = useGetFieldsOpensearchQuery({
        skip: true,
    });

    const { data: appVersionData } = useGetAppVersionsQuery({
        variables: { project_id },
    });

    const [currentRule, setCurrentRule] = useState<RuleProps | undefined>();

    const [rules, setRules] = useState<RuleProps[]>([]);
    const newRule = () => {
        setCurrentRule({
            field: undefined,
            op: undefined,
            val: undefined,
        });
        setStep1Visible(true);
    };
    const addRule = (rule: RuleProps) => {
        setRules([...rules, rule]);
        setCurrentRule(undefined);
    };
    const removeRule = (index: number) =>
        setRules(rules.filter((_, idx) => idx !== index));
    const updateRule = (index: number, newProps: any) => {
        setRules(
            rules.map((rule, idx) =>
                idx !== index ? rule : { ...rule, ...newProps }
            )
        );
    };

    const [isAnd, toggleIsAnd] = useToggle(true);

    useEffect(() => {
        const isAnd = queryBuilderState.isAnd;
        const rules = queryBuilderState.rules;
        toggleIsAnd(isAnd);
        setRules(fromJSON(rules));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getKeyOptions = async (input: string) => {
        if (fieldData?.field_types === undefined) {
            return;
        }

        const results = CUSTOM_FIELDS.concat(fieldData?.field_types)
            .map((ft) => ({
                label: ft.name,
                value: ft.type + '_' + ft.name,
            }))
            .filter((ft) =>
                (
                    getTypeLabel(ft.value)?.toLowerCase() +
                    ':' +
                    getNameLabel(ft.label).toLowerCase()
                ).includes(input.toLowerCase())
            )
            .sort((a, b) => {
                const aLower = getNameLabel(a.label).toLowerCase();
                const bLower = getNameLabel(b.label).toLowerCase();
                if (aLower < bLower) {
                    return -1;
                } else if (aLower === bLower) {
                    return 0;
                } else {
                    return 1;
                }
            });
        return results;
    };

    const getOperatorOptionsCallback = (
        options: FieldOptions | undefined,
        val: OnChangeInput
    ) => {
        return async (input: string) => {
            return (options?.operators ?? OPERATORS)
                .map((op) => getOperator(op, val))
                .filter((op) =>
                    op?.label.toLowerCase().includes(input.toLowerCase())
                );
        };
    };

    const getValueOptionsCallback = (field: SelectOption | undefined) => {
        return async (input: string) => {
            if (field === undefined) {
                return;
            }

            if (getType(field.value) === CUSTOM_TYPE) {
                let options: { label: string; value: string }[] = [];
                if (field.value === 'custom_app_version') {
                    options =
                        appVersionData?.app_version_suggestion
                            .filter((val) => !!val)
                            .map((val) => ({
                                label: val as string,
                                value: val as string,
                            })) ?? [];
                } else if (field.value === 'custom_processed') {
                    options = [
                        { label: 'Live', value: 'false' },
                        { label: 'Completed', value: 'true' },
                    ];
                } else if (getCustomFieldOptions(field)?.type === 'boolean') {
                    options = [
                        { label: 'true', value: 'true' },
                        { label: 'false', value: 'false' },
                    ];
                }

                return options.filter((opt) =>
                    opt.label?.toLowerCase().includes(input.toLowerCase())
                );
            }

            return await fetchFields({
                project_id,
                count: 10,
                field_type: getType(field.value),
                field_name: field.label,
                query: input,
            }).then((res) => {
                return res.data.fields_opensearch.map((val) => ({
                    label: val,
                    value: val,
                }));
            });
        };
    };

    useEffect(() => {
        const allComplete = rules.every(isComplete);

        if (!allComplete) {
            return;
        }

        setQueryBuilderState({ isAnd: isAnd, rules: toJSON(rules) });
        const query = parseGroup(isAnd, rules);
        setSearchQuery(JSON.stringify(query));
    }, [isAnd, rules, setSearchQuery, setQueryBuilderState]);

    const [step1Visible, setStep1Visible] = useState(false);
    const [step2Visible, setStep2Visible] = useState(false);

    return (
        <div className={styles.builderContainer}>
            {rules.length > 0 && (
                <div className={styles.rulesContainer}>
                    {rules.flatMap((rule, index) => [
                        ...(index != 0
                            ? [
                                  <Button
                                      className={styles.separator}
                                      trackingId="SessionsQuerySeparatorToggle"
                                      onClick={toggleIsAnd}
                                      key={`separator-${index}`}
                                      type="dashed"
                                  >
                                      {isAnd ? 'and' : 'or'}
                                  </Button>,
                              ]
                            : []),
                        <QueryRule
                            key={`rule-${index}`}
                            rule={rule}
                            onChangeKey={(val) => {
                                // Default to 'is' when rule is not defined yet
                                if (rule.op === undefined) {
                                    updateRule(index, {
                                        field: val,
                                        op: getDefaultOperator(rule.field),
                                    });
                                } else {
                                    updateRule(index, { field: val });
                                }
                            }}
                            getKeyOptions={getKeyOptions}
                            onChangeOperator={(val) => {
                                if (val?.kind === 'single') {
                                    updateRule(index, { op: val.value });
                                }
                            }}
                            getOperatorOptions={getOperatorOptionsCallback(
                                getCustomFieldOptions(rule.field),
                                rule.val
                            )}
                            onChangeValue={(val) => {
                                updateRule(index, { val: val });
                            }}
                            getValueOptions={getValueOptionsCallback(
                                rule.field
                            )}
                            onRemove={() => removeRule(index)}
                        />,
                    ])}
                </div>
            )}
            <div>
                <Popover
                    content={
                        currentRule?.field === undefined ||
                        currentRule?.op === undefined ? (
                            <PopoutContent
                                key={'popover-step-1'}
                                value={undefined}
                                setVisible={setStep1Visible}
                                onChange={(val) => {
                                    const field = val as
                                        | SelectOption
                                        | undefined;
                                    setCurrentRule({
                                        field: field,
                                        op: getDefaultOperator(field),
                                        val: undefined,
                                    });
                                    setStep2Visible(true);
                                }}
                                loadOptions={getKeyOptions}
                                type="select"
                                placeholder="Filter..."
                            />
                        ) : (
                            <PopoutContent
                                key={'popover-step-2'}
                                value={undefined}
                                setVisible={setStep2Visible}
                                onChange={(val) => {
                                    addRule({
                                        ...currentRule,
                                        val: val as
                                            | MultiselectOption
                                            | undefined,
                                    });
                                }}
                                loadOptions={getValueOptionsCallback(
                                    currentRule.field
                                )}
                                type={getPopoutType(currentRule.op)}
                                placeholder={`Select...`}
                            />
                        )
                    }
                    placement="bottomLeft"
                    contentContainerClassName={styles.contentContainer}
                    popoverClassName={styles.popoverContainer}
                    destroyTooltipOnHide
                    visible={step1Visible || step2Visible}
                >
                    <Button
                        className={styles.addFilter}
                        trackingId="SessionsQueryAddRule2"
                        onClick={newRule}
                        type="dashed"
                    >
                        + Filter
                    </Button>
                </Popover>
            </div>
        </div>
    );
};

export default QueryBuilder;
