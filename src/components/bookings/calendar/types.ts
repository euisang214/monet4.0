export type SlotInterval = {
    start: string;
    end: string;
};

export type SlotCellState = 'available' | 'blocked' | 'google-busy' | 'google-busy-overridden' | 'disabled';

export type SlotInput = {
    start: string | Date;
    end: string | Date;
};
