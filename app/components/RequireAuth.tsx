"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { homeForRole } from "@/app/lib/auth";
import { useSession, type Role } from "@/app/lib/session";

type Props = { roles: Role[]; children: ReactNode };

/**
 * Leva ao login quem não tem sessão, e ao próprio painel quem não tem o perfil exigido.
 * Só organiza a navegação: quem protege os dados é o back, em cada rota.
 */
export function RequireAuth({ roles, children }: Props) {
  const router = useRouter();
  const session = useSession();
  const role = session?.user.role;
  const permitido = role !== undefined && roles.includes(role);

  useEffect(() => {
    if (session === null) router.replace("/login");
    else if (role !== undefined && !permitido) router.replace(homeForRole(role));
  }, [session, role, permitido, router]);

  return permitido ? children : null;
}
