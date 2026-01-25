export class StateInvariantError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StateInvariantError';
    }
}

export class TransitionError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'TransitionError';
    }
}
