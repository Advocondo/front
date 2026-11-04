import { Logo } from "edson-alexandre-design-system";
import type { ReactNode } from "react";
import styles from "@/app/login/login.module.css";

/** Tela de acesso: painel navy com a marca e o conteúdo ao lado (ou abaixo, no celular). */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.pagina}>
      <div className={styles.marca}>
        <Logo variant="lockup" height={150} base="/brand/" />
        <div className="grid justify-items-center gap-4">
          <h1 className={styles.titulo}>Plataforma de acompanhamento</h1>
          <p className={styles.descricao}>Administração e acompanhamento dos acordos extrajudiciais das carteiras de condomínios.</p>
        </div>
      </div>
      <main className={styles.conteudo}>{children}</main>
    </div>
  );
}
