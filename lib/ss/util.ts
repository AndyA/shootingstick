export const toJSON = (obj: any) => JSON.stringify(obj ?? null);
export const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);
