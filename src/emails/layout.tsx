import type { CSSProperties, ReactNode } from "react";
import {
    Body,
    Button,
    Container,
    Head,
    Heading,
    Hr,
    Html,
    Preview,
    Section,
    Text,
} from "@react-email/components";

type EmailCallToAction = {
    label: string;
    href: string;
};

type MonetEmailLayoutProps = {
    preview: string;
    eyebrow: string;
    heading: string;
    intro: string;
    children: ReactNode;
    cta?: EmailCallToAction;
    outro?: ReactNode;
};

type DetailRowProps = {
    label: string;
    value: ReactNode;
};

type BulletListProps = {
    items: string[];
};

type CodeCardProps = {
    code: string;
};

const palette = {
    background: "#eef2ff",
    surface: "#ffffff",
    text: "#0f172a",
    muted: "#475569",
    border: "#dbe4ff",
    accent: "#1d4ed8",
    accentSoft: "#dbeafe",
    success: "#065f46",
    code: "#0b1220",
};

const bodyStyle: CSSProperties = {
    backgroundColor: palette.background,
    color: palette.text,
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    margin: 0,
    padding: "32px 0",
};

const containerStyle: CSSProperties = {
    backgroundColor: palette.surface,
    border: `1px solid ${palette.border}`,
    borderRadius: "24px",
    margin: "0 auto",
    overflow: "hidden",
    width: "100%",
    maxWidth: "640px",
};

const sectionStyle: CSSProperties = {
    padding: "0 32px",
};

const heroStyle: CSSProperties = {
    background: "linear-gradient(135deg, #eff6ff 0%, #eef2ff 100%)",
    borderBottom: `1px solid ${palette.border}`,
    padding: "28px 32px 24px",
};

const brandStyle: CSSProperties = {
    color: palette.accent,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.18em",
    margin: "0 0 16px",
    textTransform: "uppercase",
};

const eyebrowStyle: CSSProperties = {
    color: palette.accent,
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "0.12em",
    margin: "0 0 12px",
    textTransform: "uppercase",
};

const headingStyle: CSSProperties = {
    color: palette.text,
    fontSize: "30px",
    fontWeight: 700,
    letterSpacing: "-0.03em",
    lineHeight: "1.15",
    margin: "0 0 12px",
};

const introStyle: CSSProperties = {
    color: palette.muted,
    fontSize: "16px",
    lineHeight: "1.6",
    margin: 0,
};

const textStyle: CSSProperties = {
    color: palette.muted,
    fontSize: "15px",
    lineHeight: "1.7",
    margin: "0 0 16px",
};

const detailsCardStyle: CSSProperties = {
    backgroundColor: "#f8fafc",
    border: `1px solid ${palette.border}`,
    borderRadius: "18px",
    margin: "0 0 24px",
    padding: "10px 20px",
};

const detailRowStyle: CSSProperties = {
    color: palette.text,
    fontSize: "15px",
    lineHeight: "1.65",
    margin: "10px 0",
};

const detailLabelStyle: CSSProperties = {
    color: palette.text,
    fontWeight: 600,
};

const ctaSectionStyle: CSSProperties = {
    padding: "8px 0 24px",
};

const buttonStyle: CSSProperties = {
    backgroundColor: palette.accent,
    borderRadius: "999px",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: 600,
    padding: "14px 22px",
    textDecoration: "none",
};

const footerStyle: CSSProperties = {
    color: palette.muted,
    fontSize: "13px",
    lineHeight: "1.7",
    margin: "0 0 8px",
};

const bulletListStyle: CSSProperties = {
    color: palette.muted,
    fontSize: "15px",
    lineHeight: "1.7",
    margin: "0 0 16px",
    paddingLeft: "20px",
};

const codeCardStyle: CSSProperties = {
    backgroundColor: palette.code,
    borderRadius: "18px",
    color: "#ffffff",
    fontSize: "30px",
    fontWeight: 700,
    letterSpacing: "0.28em",
    margin: "0 0 20px",
    padding: "20px 24px",
    textAlign: "center",
};

export function MonetEmailLayout({
    preview,
    eyebrow,
    heading,
    intro,
    children,
    cta,
    outro,
}: MonetEmailLayoutProps) {
    return (
        <Html>
            <Head />
            <Preview>{preview}</Preview>
            <Body style={bodyStyle}>
                <Container style={containerStyle}>
                    <Section style={heroStyle}>
                        <Text style={brandStyle}>Kafei</Text>
                        <Text style={eyebrowStyle}>{eyebrow}</Text>
                        <Heading style={headingStyle}>{heading}</Heading>
                        <Text style={introStyle}>{intro}</Text>
                    </Section>

                    <Section style={sectionStyle}>
                        <div style={{ height: "28px" }} />
                        {children}

                        {cta ? (
                            <Section style={ctaSectionStyle}>
                                <Button href={cta.href} style={buttonStyle}>
                                    {cta.label}
                                </Button>
                            </Section>
                        ) : null}

                        {outro ? <>{outro}</> : null}

                        <Hr style={{ borderColor: palette.border, margin: "24px 0" }} />
                        <Text style={footerStyle}>
                            Kafei keeps scheduling, payments, and follow-ups in one streamlined flow so every session is easy to act on.
                        </Text>
                        <Text style={{ ...footerStyle, marginBottom: "28px" }}>
                            If you were not expecting this message, you can safely ignore it.
                        </Text>
                    </Section>
                </Container>
            </Body>
        </Html>
    );
}

export function EmailBodyText({ children }: { children: ReactNode }) {
    return <Text style={textStyle}>{children}</Text>;
}

export function EmailDetailCard({ children }: { children: ReactNode }) {
    return <Section style={detailsCardStyle}>{children}</Section>;
}

export function EmailDetailRow({ label, value }: DetailRowProps) {
    return (
        <Text style={detailRowStyle}>
            <span style={detailLabelStyle}>{`${label}:`}</span> {value}
        </Text>
    );
}

export function EmailBulletList({ items }: BulletListProps) {
    return (
        <ul style={bulletListStyle}>
            {items.map((item) => (
                <li key={item}>{item}</li>
            ))}
        </ul>
    );
}

export function EmailCodeCard({ code }: CodeCardProps) {
    return <div style={codeCardStyle}>{code}</div>;
}
