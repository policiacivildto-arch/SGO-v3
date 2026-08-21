// Autocompletar de matrícula: consulta o backend (RosterPolicial), em vez de
// embutir o cadastro completo do efetivo no bundle do frontend.
import { apiClient } from '../config/api';

const FALLBACK = {
  // Chave: matrícula em formato apenas dígitos
  "123456": { nome: 'KLEVER MARTINS FARIAS', cargo: 'DPC' },
  "654321": { nome: 'JOÃO PEDRO SANTOS', cargo: 'OIP' }
};

export async function findPolicialByMatricula(matricula) {
  if (!matricula) return null;
  const digits = matricula.toString().replace(/\D/g, '');
  if (!digits) return null;

  try {
    const roster = await apiClient.buscarNoRoster(digits);
    if (roster) {
      return { nome: roster.nome.toUpperCase(), cargo: (roster.cargo || '').toUpperCase() };
    }
  } catch (error) {
    console.warn('Não foi possível consultar o roster de matrículas:', error);
  }

  return FALLBACK[digits] || null;
}
