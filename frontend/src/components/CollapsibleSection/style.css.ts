import { style } from '@vanilla-extract/css'

export const collapsibleContent = style({
	margin: 0,
	maxHeight: 'calc(100vh - 540px)',
	overflowY: 'auto',
	overflowX: 'hidden',
})
