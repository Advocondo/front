"use client";

import { IconButton } from "edson-alexandre-design-system";
import { useState } from "react";
import styles from "./landing.module.css";

/** Menu de seções no celular. Fecha ao escolher uma, para não cobrir a seção de destino. */
export function NavMenu({ links }: { links: { href: string; label: string }[] }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div className={styles.menu}>
      <IconButton icon={aberto ? "x" : "menu"} label={aberto ? "Fechar menu" : "Abrir menu"} variant="inverse" aria-expanded={aberto} onClick={() => setAberto((v) => !v)} />
      {aberto && (
        <div className={styles.menuLista}>
          {links.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setAberto(false)}>
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
