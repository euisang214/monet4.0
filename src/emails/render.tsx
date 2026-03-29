import type { ReactElement } from "react";
import { render, toPlainText } from "@react-email/render";

export async function renderEmailTemplate(
    element: ReactElement,
    textOverride?: string,
) {
    const html = await render(element);
    return {
        html,
        text: textOverride ?? toPlainText(html),
    };
}
