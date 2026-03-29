import { cn } from "@/lib/ui/cn";
import styles from "./AuthenticatedContentFrame.module.css";

interface AuthenticatedContentFrameProps {
    children: React.ReactNode;
    className?: string;
}

export function AuthenticatedContentFrame({ children, className }: AuthenticatedContentFrameProps) {
    return (
        <div className={styles.shell}>
            <div className={cn(styles.frame, className)} data-page-shell="true">{children}</div>
        </div>
    );
}
