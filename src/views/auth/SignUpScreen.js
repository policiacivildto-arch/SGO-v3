import React, { useState } from 'react';
import { apiClient } from '../../config/api';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { UserPlus } from 'lucide-react';
import { LoadingSpinner } from '../../components/ui/Shared';
import { formatTelefone, formatMatricula, normalizeName } from '../../utils/helpers';
import { findPolicialByMatricula } from '../../constants/policiais';
import { DEPARTMENTS } from '../../constants/data';
export const SignUpScreen = ({ showNotification, setAuthScreen }) => {

    // --- ALTERADO: Adicionado 'cargo' e 'classe' ao estado inicial do formulário ---
    const [formData, setFormData] = useState({ 
        nome: '', 
        matricula: '', 
        departamento: '', 
        delegacia: '', 
        telefone: '', 
        cargo: '', // --- NOVO ---
        classe: '', // --- NOVO ---
        email: '', 
        password: '' 
    });
    const [isLoading, setIsLoading] = useState(false);
    const [registerNotice, setRegisterNotice] = useState('');

    const handleChange = (field, value) => {
        const updatedData = { ...formData, [field]: value };
        if (registerNotice) setRegisterNotice('');
        if (field === 'departamento') updatedData.delegacia = '';

        // --- NOVO: Reseta a classe quando o cargo é alterado ---
        if (field === 'cargo') updatedData.classe = '';

        if (field === 'telefone') updatedData.telefone = formatTelefone(value);
        if (field === 'matricula') {
            updatedData.matricula = formatMatricula(value);
        }
        setFormData(updatedData);

        if (field === 'matricula') {
            const formatted = updatedData.matricula;
            // Tentar autocompletar nome e cargo consultando o roster no backend
            findPolicialByMatricula(formatted).then((encontrado) => {
                if (!encontrado) return;
                setFormData((prev) => (
                    prev.matricula === formatted ? { ...prev, nome: encontrado.nome, cargo: encontrado.cargo } : prev
                ));
            });
        }
    };

    const handleSignUp = async (e) => {
        e.preventDefault();
        setRegisterNotice('');
        const telefoneDigits = formData.telefone.replaceAll(/\D/g, '').length;
        // A validação 'some(val => val === '')' agora inclui os novos campos 'cargo' e 'classe'
        if (Object.values(formData).includes('') || formData.password.length < 6 || (telefoneDigits !== 10 && telefoneDigits !== 11)) {
            showNotification("Preencha todos os campos. A senha deve ter no mínimo 6 caracteres e o telefone 10 ou 11 dígitos.", "error");
            return;
        }
        setIsLoading(true);
        try {
            const userData = {
                username: formData.email.trim().toLowerCase(),
                password: formData.password,
                email: formData.email.trim(),
                nome: normalizeName(formData.nome),
                matricula: formData.matricula,
                departamento: formData.departamento,
                delegacia: formData.delegacia,
                telefone: formData.telefone,
                cargo: formData.cargo,
                classe: formData.classe,
                role: 'policial'
            };
            
            await apiClient.register(userData);
            showNotification("Conta criada com sucesso! Você já pode fazer o login.", "success");
            setAuthScreen('login');
        } catch (error) {
            console.error("Erro ao criar conta:", error);
            const rawMessage = error?.message || '';
            const message = rawMessage.toLowerCase();

            if (message.includes('email já existe')) {
                const notice = 'Este email já está cadastrado. Se a conta for sua, use a tela de login.';
                setRegisterNotice(notice);
                showNotification(notice, 'error');
            } else if (message.includes('matricula já existe')) {
                const notice = 'Esta matrícula já está cadastrada no sistema. Verifique se você já possui conta.';
                setRegisterNotice(notice);
                showNotification(notice, 'error');
            } else if (message.includes('username já existe') || message.includes('usuário já existe') || message.includes('usuario já existe')) {
                const notice = 'Este usuário já está cadastrado. Tente entrar com sua conta existente.';
                setRegisterNotice(notice);
                showNotification(notice, 'error');
            } else if (message.includes('already') || message.includes('já existe')) {
                const notice = rawMessage || 'Este usuário já está cadastrado no sistema.';
                setRegisterNotice(notice);
                showNotification(notice, 'error');
            } else {
                showNotification("Ocorreu um erro ao criar a conta no Django.", "error");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <AuthLayout title="Criar Nova Conta">
            <form onSubmit={handleSignUp} className="space-y-4">
                {registerNotice && (
                    <div className="rounded-lg border border-amber-500 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                        <div className="font-semibold">Cadastro já existente</div>
                        <div>{registerNotice}</div>
                    </div>
                )}
                <input type="text" placeholder="Nome Completo" value={formData.nome} onChange={e => handleChange('nome', e.target.value)} className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600" required />
                <input type="text" placeholder="Matrícula" value={formData.matricula} onChange={e => handleChange('matricula', e.target.value)} className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600" required />
                <select value={formData.departamento} onChange={e => handleChange('departamento', e.target.value)} className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600" required><option value="">Selecione o Departamento</option>{Object.keys(DEPARTMENTS).map(d => <option key={d} value={d}>{d}</option>)}</select>
                <select value={formData.delegacia} onChange={e => handleChange('delegacia', e.target.value)} className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600" required disabled={!formData.departamento}><option value="">Selecione a Delegacia</option>{formData.departamento && DEPARTMENTS[formData.departamento].map(d => <option key={d} value={d}>{d}</option>)}</select>
                
                {/* --- NOVO: Campos de Cargo e Classe --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                         <select value={formData.cargo} onChange={e => handleChange('cargo', e.target.value)} className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600" required>
                            <option value="">Selecione o Cargo</option>
                            <option value="DPC">(DPC)</option>
                            <option value="OIP">(OIP)</option>
                         </select>
                    </div>
                     <div>
                         <select value={formData.classe} onChange={e => handleChange('classe', e.target.value)} className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600" required disabled={!formData.cargo}>
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
                {/* --- FIM dos novos campos --- */}

                <input type="tel" placeholder="Telefone" value={formData.telefone} onChange={e => handleChange('telefone', e.target.value)} maxLength="15" className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600" required />
                <input type="email" placeholder="seuemail@pcce.com" value={formData.email} onChange={e => handleChange('email', e.target.value)} className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600" required />
                <input type="password" placeholder="Senha (mínimo 6 caracteres)" value={formData.password} onChange={e => handleChange('password', e.target.value)} className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600" required />
                <button type="submit" disabled={isLoading} className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:bg-gray-500">
                    {isLoading ? <LoadingSpinner /> : <><UserPlus size={20} /><span>Criar Conta</span></>}
                </button>
            </form>
            <div className="text-center mt-4 text-sm">
                <button onClick={() => setAuthScreen('login')} className="text-blue-400 hover:underline">Já tem uma conta? Entrar</button>
            </div>
        </AuthLayout>
    );
};
