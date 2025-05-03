type stateType = 'equal' | 'different' | 'not-compared';

export interface stateComparison {
	base: string;
	state: stateType;
}
