// src/componets/forms/forms.js
import React, { useState } from 'react';
import { DEPARTMENTS } from '../../constants/data';
import { formatMatricula, formatTelefone, normalizeName } from '../../utils/helpers';
import { findPolicialByMatricula } from '../../constants/policiais';           
   export const UserForm = ({ user, onSave }) => {
   const [formData, setFormData] = useState({ 
        id: '', nome: '', matricula: '', departamento: '', delegacia: '', 
        telefone: '', role: 'policial', cargo: '', classe: '', ...user });
    const handleChange = (field, value) => {
        const updatedData = { ...formData, [field]: value };
        if (field === 'departamento') updatedData.delegacia = '';
        if (field === 'telefone') updatedData.telefone = formatTelefone(value);
        setFormData(updatedData);

        if (field === 'matricula') {
            findPolicialByMatricula(value).then((found) => {
                if (!found) return;
                setFormData((prev) => (
                    prev.matricula === value ? { ...prev, nome: found.nome, cargo: found.cargo } : prev
                ));
            });
        }
    };
    const handleSubmit = (e) => { e.preventDefault(); onSave(formData); };
    return (
        <form onSubmit={handleSubmit} className="space-y-4 text-gray-800">
            <h2 className="text-xl font-bold">{user ? 'Editar Policial' : 'Novo Policial'}</h2>
            {!user && <p className="text-sm text-red-600 bg-red-100 p-2 rounded">Lembrete: cadastre primeiro o usuário no sistema e informe o identificador no campo "UID do Usuário".</p>}
            {!user && <div><label className="font-semibold">UID do Usuário (ID do Documento)</label><input type="text" value={formData.id || ''} onChange={e => handleChange('id', e.target.value)} className="w-full p-2 border rounded mt-1" required /></div>}
            <div><label className="font-semibold">Nome</label><input type="text" value={formData.nome} onChange={e => handleChange('nome', normalizeName(e.target.value))} className="w-full p-2 border rounded mt-1 uppercase" required /></div>
            <div><label className="font-semibold">Matrícula</label><input type="text" value={formData.matricula} onChange={e => handleChange('matricula', formatMatricula(e.target.value))} className="w-full p-2 border rounded mt-1" required /></div>
            <div><label className="font-semibold">Telefone</label><input type="tel" value={formData.telefone} onChange={e => handleChange('telefone', e.target.value)} maxLength="15" className="w-full p-2 border rounded mt-1" required /></div>
            <div><label className="font-semibold">Departamento</label><select value={formData.departamento} onChange={e => handleChange('departamento', e.target.value)} className="w-full p-2 border rounded mt-1 bg-white" required><option value="">Selecione...</option>{Object.keys(DEPARTMENTS).map(d => <option key={d} value={d}>{d}</option>)}</select></div>
            <div><label className="font-semibold">Delegacia</label><select value={formData.delegacia} onChange={e => handleChange('delegacia', e.target.value)} className="w-full p-2 border rounded mt-1 bg-white" required disabled={!formData.departamento}><option value="">Selecione...</option>{formData.departamento && DEPARTMENTS[formData.departamento].map(d => <option key={d} value={d}>{d}</option>)}</select></div>
            <div><label className="font-semibold">Perfil</label><select value={formData.role} onChange={e => handleChange('role', e.target.value)} className="w-full p-2 border rounded mt-1 bg-white" required><option value="policial">Policial</option><option value="admin">Administrador</option></select></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="font-semibold">Cargo</label>
                    <select value={formData.cargo} onChange={e => handleChange('cargo', e.target.value)} className="w-full p-2 border rounded mt-1 bg-white" required>
                        <option value="">Selecione o Cargo</option>
                        <option value="DPC">Delegado (DPC)</option>
                        <option value="OIP">Inspetor (OIP)</option>
                        {/* Adicionar outros cargos aqui se necessário */}
                    </select>
                </div>
                <div>
                    <label className="font-semibold">Classe</label>
                    {/* O select de classe muda dependendo do cargo selecionado */}
                    <select value={formData.classe} onChange={e => handleChange('classe', e.target.value)} className="w-full p-2 border rounded mt-1 bg-white" required disabled={!formData.cargo}>
                        <option value="">Selecione a Classe</option>
                        {formData.cargo === 'DPC' && <option value="Especial">Especial</option>}
                        {formData.cargo === 'OIP' && <>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                        </>}
                    </select>
                </div>
            </div>
            <div className="flex justify-end"><button type="submit" className="bg-blue-600 text-white py-2 px-6 rounded-lg">Salvar</button></div>
        </form>
    );
};