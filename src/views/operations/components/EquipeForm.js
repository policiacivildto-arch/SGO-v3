import React from 'react';
import { Users } from 'lucide-react';
import { findPolicialByMatricula } from '../../../constants/policiais';
import { ORGANOGRAMA } from '../../../constants/data';

export function EquipeForm({ 
    equipeForm, 
    setEquipeForm, 
    equipes, 
    setEquipes, 
    selectedOperationId,
    showNotification,
    setShowEquipeForm 
}) {
    const handleSubmit = (e) => {
        e.preventDefault();
        const form = e.target;
        const policiais = [];
        let lider = null;
        
        // Coletar policiais
        for (let i = 1; i <= 4; i++) {
            const nome = form[`policial${i}_nome`]?.value;
            if (nome) {
                policiais.push(nome);
                if (form[`policial${i}_lider`]?.checked) {
                    lider = nome;
                }
            }
        }
        
        const novaEquipe = {
            id: Date.now(),
            operacaoId: selectedOperationId,
            departamento: equipeForm.departamento,
            delegacia: equipeForm.delegacia || '',
            viatura: equipeForm.viatura,
            chefe: lider || policiais[0] || '',
            membros: policiais.filter(p => p !== lider),
            alvosVinculados: []
        };
        
        setEquipes([...equipes, novaEquipe]);
        showNotification('Equipe adicionada com sucesso!', 'success');
        setShowEquipeForm(false);
        setEquipeForm({ departamento: '', delegacia: '', chefe: '', membros: [], viatura: '' });
    };

    return (
        <div className="bg-gray-700 p-6 rounded-lg">
            <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-bold text-white">🚔 Equipes Operacionais</h4>
                <span className="text-sm text-gray-400">Efetivo de 3 a 4 policiais</span>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Dados da Equipe */}
                <div className="bg-gray-600 p-4 rounded-lg space-y-4">
                    <h5 className="font-semibold text-white">Dados da Equipe</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-300 mb-2">Departamento *</label>
                            <select
                                required
                                value={equipeForm.departamento}
                                onChange={(e) => {
                                    const novoDept = e.target.value;
                                    setEquipeForm({ 
                                        ...equipeForm, 
                                        departamento: novoDept,
                                        delegacia: '' // Limpa a delegacia ao mudar o departamento
                                    });
                                }}
                                className="w-full bg-gray-700 text-white rounded px-4 py-2 border border-gray-500"
                            >
                                <option value="">Selecione um departamento</option>
                                {Object.keys(ORGANOGRAMA).map(dept => (
                                    <option key={dept} value={dept}>
                                        {dept}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-300 mb-2">
                                Delegacia/Unidade {equipeForm.departamento && ORGANOGRAMA[equipeForm.departamento]?.length > 0 ? '*' : ''}
                            </label>
                            <select
                                required={equipeForm.departamento && ORGANOGRAMA[equipeForm.departamento]?.length > 0}
                                disabled={!equipeForm.departamento || ORGANOGRAMA[equipeForm.departamento]?.length === 0}
                                value={equipeForm.delegacia}
                                onChange={(e) => setEquipeForm({ ...equipeForm, delegacia: e.target.value })}
                                className="w-full bg-gray-700 text-white rounded px-4 py-2 border border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">
                                    {!equipeForm.departamento 
                                        ? 'Selecione primeiro o departamento' 
                                        : ORGANOGRAMA[equipeForm.departamento]?.length === 0
                                        ? 'Sem unidades vinculadas'
                                        : 'Selecione uma delegacia/unidade'}
                                </option>
                                {equipeForm.departamento && ORGANOGRAMA[equipeForm.departamento]?.map(delegacia => (
                                    <option key={delegacia} value={delegacia}>
                                        {delegacia}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-300 mb-2">Placa da Viatura</label>
                            <input
                                type="text"
                                value={equipeForm.viatura}
                                onChange={(e) => setEquipeForm({ ...equipeForm, viatura: e.target.value })}
                                className="w-full bg-gray-700 text-white rounded px-4 py-2 border border-gray-500"
                                placeholder="ABC-1234"
                            />
                        </div>
                    </div>
                </div>

                {/* OIP - Policiais */}
                <div className="bg-gray-600 p-4 rounded-lg space-y-4">
                    <h5 className="font-semibold text-white">👮 OIP - Oficiais de Investigação Policial</h5>
                    
                    {/* Policial 1 */}
                    <div className="bg-gray-700 p-4 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                            <h6 className="text-white font-semibold">Policial 1 *</h6>
                            <label className="flex items-center space-x-2 text-cyan-400 cursor-pointer">
                                <input type="checkbox" name="policial1_lider" className="w-4 h-4" />
                                <span className="font-semibold">Líder</span>
                            </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                                type="text"
                                name="policial1_matricula"
                                placeholder="Matrícula"
                                onChange={async (e) => {
                                    const matricula = e.target.value;
                                    const found = await findPolicialByMatricula(matricula);
                                    const matriculaInput = document.querySelector('input[name="policial1_matricula"]');
                                    const nomeInput = document.querySelector('input[name="policial1_nome"]');
                                    if (matriculaInput && matriculaInput.value !== matricula) return;
                                    if (found && nomeInput) nomeInput.value = found.nome;
                                    else if (nomeInput) nomeInput.value = '';
                                }}
                                className="w-full bg-gray-600 text-white rounded px-4 py-2 border border-gray-500"
                            />
                            <input
                                type="text"
                                name="policial1_nome"
                                required
                                placeholder="Nome completo do policial"
                                className="w-full bg-gray-600 text-white rounded px-4 py-2 border border-gray-500"
                            />
                        </div>
                    </div>

                    {/* Policial 2 */}
                    <div className="bg-gray-700 p-4 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                            <h6 className="text-white font-semibold">Policial 2 *</h6>
                            <label className="flex items-center space-x-2 text-cyan-400 cursor-pointer">
                                <input type="checkbox" name="policial2_lider" className="w-4 h-4" />
                                <span className="font-semibold">Líder</span>
                            </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                                type="text"
                                name="policial2_matricula"
                                placeholder="Matrícula"
                                onChange={async (e) => {
                                    const matricula = e.target.value;
                                    const found = await findPolicialByMatricula(matricula);
                                    const matriculaInput = document.querySelector('input[name="policial2_matricula"]');
                                    const nomeInput = document.querySelector('input[name="policial2_nome"]');
                                    if (matriculaInput && matriculaInput.value !== matricula) return;
                                    if (found && nomeInput) nomeInput.value = found.nome;
                                    else if (nomeInput) nomeInput.value = '';
                                }}
                                className="w-full bg-gray-600 text-white rounded px-4 py-2 border border-gray-500"
                            />
                            <input
                                type="text"
                                name="policial2_nome"
                                required
                                placeholder="Nome completo do policial"
                                className="w-full bg-gray-600 text-white rounded px-4 py-2 border border-gray-500"
                            />
                        </div>
                    </div>

                    {/* Policial 3 */}
                    <div className="bg-gray-700 p-4 rounded-lg space-y-3">
                        <div className="flex justify-between items-center">
                            <h6 className="text-white font-semibold">Policial 3 *</h6>
                            <label className="flex items-center space-x-2 text-cyan-400 cursor-pointer">
                                <input type="checkbox" name="policial3_lider" className="w-4 h-4" />
                                <span className="font-semibold">Líder</span>
                            </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                                type="text"
                                name="policial3_matricula"
                                placeholder="Matrícula"
                                onChange={async (e) => {
                                    const matricula = e.target.value;
                                    const found = await findPolicialByMatricula(matricula);
                                    const matriculaInput = document.querySelector('input[name="policial3_matricula"]');
                                    const nomeInput = document.querySelector('input[name="policial3_nome"]');
                                    if (matriculaInput && matriculaInput.value !== matricula) return;
                                    if (found && nomeInput) nomeInput.value = found.nome;
                                    else if (nomeInput) nomeInput.value = '';
                                }}
                                className="w-full bg-gray-600 text-white rounded px-4 py-2 border border-gray-500"
                            />
                            <input
                                type="text"
                                name="policial3_nome"
                                required
                                placeholder="Nome completo do policial"
                                className="w-full bg-gray-600 text-white rounded px-4 py-2 border border-gray-500"
                            />
                        </div>
                    </div>

                    {/* Policial 4 (Opcional) */}
                    <div className="bg-gray-700 p-4 rounded-lg space-y-3 border-2 border-dashed border-gray-600">
                        <div className="flex justify-between items-center">
                            <h6 className="text-gray-400 font-semibold">Policial 4 (Opcional)</h6>
                            <label className="flex items-center space-x-2 text-cyan-400 cursor-pointer">
                                <input type="checkbox" name="policial4_lider" className="w-4 h-4" />
                                <span className="font-semibold">Líder</span>
                            </label>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <input
                                type="text"
                                name="policial4_matricula"
                                placeholder="Matrícula"
                                onChange={async (e) => {
                                    const matricula = e.target.value;
                                    const found = await findPolicialByMatricula(matricula);
                                    const matriculaInput = document.querySelector('input[name="policial4_matricula"]');
                                    const nomeInput = document.querySelector('input[name="policial4_nome"]');
                                    if (matriculaInput && matriculaInput.value !== matricula) return;
                                    if (found && nomeInput) nomeInput.value = found.nome;
                                    else if (nomeInput) nomeInput.value = '';
                                }}
                                className="w-full bg-gray-600 text-white rounded px-4 py-2 border border-gray-500"
                            />
                            <input
                                type="text"
                                name="policial4_nome"
                                placeholder="Nome completo do policial"
                                className="w-full bg-gray-600 text-white rounded px-4 py-2 border border-gray-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Botões */}
                <div className="flex justify-end space-x-4">
                    <button
                        type="button"
                        onClick={() => setShowEquipeForm(false)}
                        className="bg-gray-500 hover:bg-gray-600 px-6 py-2 rounded text-white"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded text-white font-semibold"
                    >
                        ✓ Adicionar Equipe
                    </button>
                </div>
            </form>
        </div>
    );
}
