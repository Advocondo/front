"use client";

import { Badge, Card, Icon } from "edson-alexandre-design-system";
import Link from "next/link";
import { itensDoMais } from "@/app/components/navegacao";
import { PlataformaShell } from "@/app/components/PlataformaShell";
import { ROTULO_DO_PERFIL } from "@/app/(equipe)/usuarios/api";
import { logOut } from "@/app/lib/auth";
import { useSession } from "@/app/lib/session";

const LINHA = "flex items-center gap-3 px-4 py-3 text-left";

/** Quinto item da navegação inferior no celular: o que não coube na barra, o perfil e o Sair. */
export function MaisView() {
  const usuario = useSession()?.user;
  const itens = itensDoMais(usuario?.role);

  return (
    <PlataformaShell activeId="mais" title="Mais">
      <div className="mx-auto grid w-full max-w-xl gap-4">
        {usuario && (
          <Card>
            <p className="font-semibold">{usuario.name}</p>
            <p className="text-sm">{`${ROTULO_DO_PERFIL[usuario.role]} · ${usuario.email}`}</p>
          </Card>
        )}

        <Card padding="none">
          <ul className="divide-y divide-[var(--border-subtle)]" aria-label="Outras telas">
            {itens.map((item) => (
              <li key={item.id}>
                <Link href={item.href} className={LINHA} style={{ color: "inherit", textDecoration: "none" }}>
                  <Icon name={item.icon} size={20} />
                  <span className="grid min-w-0 flex-1">
                    <span className="font-medium">{item.label}</span>
                    <span className="text-sm">{item.descricao}</span>
                  </span>
                  {item.soAdmin && <Badge tone="brand">Admin</Badge>}
                  <Icon name="chevron-right" size={18} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card padding="none">
          <button type="button" className={`${LINHA} w-full`} onClick={() => void logOut()}>
            <Icon name="log-out" size={20} />
            <span className="grid flex-1">
              <span className="font-medium">Sair</span>
              <span className="text-sm">Encerra só esta sessão</span>
            </span>
          </button>
        </Card>
      </div>
    </PlataformaShell>
  );
}
