import { ensureAdmin } from "./seed";

/**
 * Roda uma vez, antes de todos os arquivos. Sem isto, quem entra como Administrador só funciona se
 * outro arquivo já tiver criado o usuário, e a suíte falha conforme a ordem em um banco vazio.
 */
export default async function criarAdministrador(): Promise<void> {
  await ensureAdmin();
}
