"use client";

import { TextareaHTMLAttributes, useCallback, useEffect, useRef } from "react";

type AutoResizeTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function AutoResizeTextarea({
    className = "",
    onInput,
    ...props
}: AutoResizeTextareaProps) {
    const textareaRef = useRef<HTMLTextAreaElement | null>(null);

    const resize = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
    }, []);

    useEffect(() => {
        resize();
    }, [props.value, resize]);

    return (
        <textarea
            {...props}
            ref={textareaRef}
            className={`${className} resize-none overflow-hidden`}
            onInput={(event) => {
                resize();
                onInput?.(event);
            }}
        />
    );
}
