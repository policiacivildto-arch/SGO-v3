import React, { useState, useEffect } from 'react';
import { 
    Menu, X, LayoutDashboard, Plus, ClipboardList, CheckCircle, 
    FileText, Target, BarChart, Users
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { findPolicialByMatricula } from '../../constants/policiais';
import { DEPARTMENTS } from '../../constants/data';

// Importar componentes de visualização
import { DashboardView } from './components/DashboardView';
import { NovaDemandaView } from './components/NovaDemandaView';
import { PlanejamentoView } from './components/PlanejamentoView';
import { RelatorioView } from './components/RelatorioView';
import { ResultadosOperacaoView } from './components/ResultadosOperacaoView';
import { MeusAlvosView } from './components/MeusAlvosView';
import { EstatisticasView } from './components/EstatisticasView';
import { AprovacaoDTO } from './components/AprovacaoDTO';
import { VincularAlvosEquipes } from './components/VincularAlvosEquipes';

/**
 * OperationsDashboard - Dashboard completo do Sistema de OPERAÇÕES (Modularizado)
 * Gerencia todo o ciclo de operações policiais
 */
export default function OperationsDashboard({ userData, showNotification }) {
    // Verificar tipo de usuário
    const isDTO = userData?.role === 'admin';
    const isDepartamento = userData?.role === 'departamento';
    const isPolicialOperacional = !isDTO && !isDepartamento;
    const userDepartamento = userData?.departamento || '';
    
    // Debug
    console.log('=== OPERATIONS DASHBOARD DEBUG ===');
    console.log('userData:', userData);
    console.log('isDTO:', isDTO);
    console.log('isDepartamento:', isDepartamento);
    console.log('userDepartamento:', userDepartamento);
    
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeView, setActiveView] = useState(isPolicialOperacional ? 'relatorio' : 'dashboard');
    const [operations, setOperations] = useState([]);
    const [selectedOperation, setSelectedOperation] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [stats, setStats] = useState({
        aguardandoAprovacao: 0,
        aprovadas: 0,
        emExecucao: 0,
        concluidas: 0
    });

    // Estado do formulário de nova demanda
    const [formData, setFormData] = useState({
        nome: '',
        orgao_solicitante: '',
        delegacia_responsavel: '',
        data_inicio: '',
        hora_inicio: '',
        hora_fim: '08:00',
        status_dto: 'Aguardando Análise DTO',
        objetivo: '',
        locais_briefing: [''],
        // 4.1 Tipo Penal
        tipos_penais: [],
        tipo_penal_outros: '',
        // 4.2 Modalidade
        modalidades: {
            busca_apreensao: 0,
            prisao_preventiva: 0,
            prisao_temporaria: 0,
            sequestro_bens: 0
        },
        modalidade_outros: '',
        // 4.3 AIS
        ais_locais: [],
        // 4.4 Facção
        faccoes: [],
        faccao_outros: '',
        // 4.5 Alvos Sensíveis
        alvos_sensiveis: [],
        alvos_sensiveis_outros: '',
        // Apoio de outros departamentos
        apoio_outros_departamentos: '',
        // 5. Apoio Operacional
        precisa_apoio_operacional: false,
        apoio_operacional_dpc: 0,
        apoio_operacional_oip: 0,
        apoio_cartorario_dpc: 0,
        apoio_cartorario_oip: 0,
        // 6. Órgãos de apoio
        orgaos_apoio: [],
        // 7. Efetivo Interno
        efetivo_interno_dpc: 0,
        efetivo_interno_oip: 0,
        // Campos de controle
        precisa_apoio_dto: false,
        departamento_demandante: userDepartamento || '',
        responsavel_alvos: userDepartamento || ''
    });

    // Estados do Planejamento
    const [selectedOperationId, setSelectedOperationId] = useState(null);
    const [showEquipeForm, setShowEquipeForm] = useState(false);
    const [showAlvoForm, setShowAlvoForm] = useState(false);
    const [showPlanoForm, setShowPlanoForm] = useState(false);
    const [equipeForm, setEquipeForm] = useState({ departamento: '', delegacia: '', chefe: '', membros: [], viatura: '' });
    const [alvoForm, setAlvoForm] = useState({
        nome_operacao: '', nome: '', filiacao: '', cpf: '', rg: '', data_nascimento: '',
        endereco_cumprimento: '', endereco_alvo: '', observacoes_confirmacao: '',
        deslocamento_previsto: '', print_maps_url: '', endereco_pem: 'Instituto José Frota - IJF',
        foto_maps_pem: '', qrcode_pem: '', observacoes_finais: ''
    });
    const [planoForm, setPlanoForm] = useState({
        numeroPlano: '', dataOperacao: '', tipoSolicitacao: 'NUP', delegaciaSolicitante: '',
        departamentoSolicitante: '', mandados: [{ tipo: '', quantidade: 1 }], cidades: '',
        horarioApresentacao: '', localApresentacao: '', departamentosEnvolvidos: '',
        departamentoDemandante: '', diretor: '', diretorDemandante: '', dataEmissao: ''
    });
    
    const [alvos, setAlvos] = useState([]);
    const [equipes, setEquipes] = useState([]);
    const [draggedAlvo, setDraggedAlvo] = useState(null);

    const defaultView = isPolicialOperacional ? 'relatorio' : 'dashboard';
    const availableViews = new Set([
        'relatorio',
        'relatorio-operacao',
        ...(isDTO || isDepartamento ? ['dashboard', 'nova-demanda', 'planejamento', 'equipes', 'vincular-alvos', 'estatisticas'] : []),
        ...(isDTO ? ['aprovacao'] : []),
        ...(isPolicialOperacional ? ['meus-alvos'] : []),
    ]);

    const setActiveViewAndSyncUrl = (nextView) => {
        const safeView = availableViews.has(nextView) ? nextView : defaultView;

        if (safeView === activeView) return;

        setActiveView(safeView);
        const nextParams = new URLSearchParams(searchParams);
        if (safeView === defaultView) {
            nextParams.delete('view');
        } else {
            nextParams.set('view', safeView);
        }
        setSearchParams(nextParams, { replace: true });
    };

    useEffect(() => {
        const viewFromUrl = searchParams.get('view');
        const targetView = viewFromUrl && availableViews.has(viewFromUrl)
            ? viewFromUrl
            : defaultView;

        if (targetView !== activeView) {
            setActiveView(targetView);
        }
    }, [searchParams, activeView, defaultView, isDTO, isDepartamento, isPolicialOperacional]);
    
    // Função para buscar policial por matrícula (consulta o roster no backend)
    const buscarPolicialPorMatricula = async (matricula) => {
        if (!matricula || matricula.trim().length < 3) return null;
        const found = await findPolicialByMatricula(matricula.trim());
        return found ? found.nome : null;
    };
    const [selectedOperationRelatorio, setSelectedOperationRelatorio] = useState(null);
    const [showSubstituicaoModal, setShowSubstituicaoModal] = useState(false);
    const [policiaisPresenca, setPoliciaisPresenca] = useState({});
    const [resultadosOperacao, setResultadosOperacao] = useState(() => {
        // Carregar resultados salvos do localStorage
        const saved = localStorage.getItem('resultadosOperacao');
        return saved ? JSON.parse(saved) : {};
    });
    const [informacoesAlvos, setInformacoesAlvos] = useState(() => {
        // Carregar informações dos alvos do localStorage
        const saved = localStorage.getItem('informacoesAlvos');
        return saved ? JSON.parse(saved) : {};
    });

    // Recalcular stats quando operations mudar
    useEffect(() => {
        if (operations.length > 0) {
            loadStats();
        }
    }, [operations]);

    // Salvar resultados no localStorage quando houver mudanças
    useEffect(() => {
        if (Object.keys(resultadosOperacao).length > 0) {
            localStorage.setItem('resultadosOperacao', JSON.stringify(resultadosOperacao));
            console.log('✅ Resultados salvos em tempo real:', resultadosOperacao);
        }
    }, [resultadosOperacao]);

    // Salvar informações dos alvos no localStorage
    useEffect(() => {
        if (Object.keys(informacoesAlvos).length > 0) {
            localStorage.setItem('informacoesAlvos', JSON.stringify(informacoesAlvos));
            console.log('✅ Informações dos alvos salvas:', informacoesAlvos);
        }
    }, [informacoesAlvos]);

    // Identificar equipes e operações do policial
    const nomePolicial = userData?.nome || userData?.displayName || 'Klever Farias Martins';
    const emailPolicial = userData?.email || '';
    
    console.log('🔍 DEBUG - userData:', userData);
    console.log('🔍 DEBUG - nomePolicial:', nomePolicial);
    console.log('🔍 DEBUG - emailPolicial:', emailPolicial);
    console.log('🔍 DEBUG - Todas as equipes:', equipes);
    console.log('🔍 DEBUG - Todos os alvos:', alvos);
    
    const equipesDoPolicialAtual = isPolicialOperacional 
        ? equipes.filter(eq => 
            eq.chefe?.toUpperCase() === nomePolicial?.toUpperCase() || 
            (eq.membros && eq.membros.some(m => m?.toUpperCase() === nomePolicial?.toUpperCase())) ||
            (emailPolicial.toLowerCase() === 'kleverdpc@gmail.com' && eq.chefe?.toUpperCase().includes('KLEVER'))
        )
        : isDepartamento
        ? equipes.filter(eq => eq.departamento === userDepartamento)
        : equipes;

    console.log('🔍 DEBUG - equipesDoPolicialAtual:', equipesDoPolicialAtual);

    // Filtrar operações baseado no tipo de usuário
    const operacoesDoPolicialAtual = isPolicialOperacional
        ? operations.filter(op => equipesDoPolicialAtual.some(eq => eq.operacaoId === op.id))
        : isDepartamento
        ? operations.filter(op => op.departamento === userDepartamento || op.departamento_solicitante === userDepartamento || op.departamento_solicitante_sigla === userDepartamento)
        : operations;

    const alvosDoPolicialAtual = isPolicialOperacional
        ? alvos.filter(alvo => alvo.equipesVinculadas && alvo.equipesVinculadas.some(eqId => 
            equipesDoPolicialAtual.some(eq => eq.id === eqId)))
        : isDepartamento
        ? alvos.filter(alvo => alvo.departamento === userDepartamento)
        : alvos;
    
    console.log('🔍 DEBUG - alvosDoPolicialAtual:', alvosDoPolicialAtual);

    useEffect(() => {
        loadOperations();
        loadMockData();
    }, []);

    const loadMockData = () => {
        // Adicionar alvos de teste
        setAlvos([
            {
                id: 1,
                operacaoId: 3,
                nome: 'José da Silva Santos',
                vulgo: 'Zé Pequeno',
                cpf: '987.654.321-00',
                foto: null,
                envolvimento: 'Tráfico de Drogas',
                mandado: true,
                numeroInquerito: '001/2025',
                dataFatos: '2025-11-15',
                artigo: 'Art. 33 Lei 11.343/06',
                endereco: 'Rua das Flores, 123',
                bairro: 'Centro',
                cidade: 'Fortaleza',
                referencia: 'Próximo ao mercado central',
                informacoesAdicionais: 'Alvo confirmado pela equipe de inteligência. Alta periculosidade. Líder de facção local.',
                status: 'pendente',
                equipesVinculadas: [1]
            },
            {
                id: 2,
                operacaoId: 3,
                nome: 'Carlos Alberto Mendes',
                vulgo: 'Carlão',
                cpf: '123.456.789-00',
                foto: null,
                envolvimento: 'Roubo',
                mandado: true,
                numeroInquerito: '045/2025',
                dataFatos: '2025-12-01',
                artigo: 'Art. 157 CP',
                endereco: 'Avenida Principal, 456',
                bairro: 'Bairro Industrial',
                cidade: 'Fortaleza',
                referencia: 'Ao lado da oficina mecânica',
                informacoesAdicionais: 'Especializado em roubo de veículos. Possui tatuagem de cobra no braço direito.',
                status: 'pendente',
                equipesVinculadas: [1]
            }
        ]);

        // Adicionar equipe de teste com Klever como líder
        setEquipes([
            {
                id: 1,
                operacaoId: 3,
                departamento: 'DRE',
                delegacia: '1ª Delegacia',
                chefe: 'KLEVER MARTINS FARIAS',
                membros: ['João Pedro Santos', 'Maria Oliveira Silva', 'Pedro Costa Lima'],
                viatura: 'ABC-1234',
                alvosVinculados: [1, 2]
            }
        ]);
    };

    const loadOperations = async () => {
        try {
            setLoading(true);
            
            // Tentar carregar do backend Django
            try {
                const djangoApi = (await import('../../services/djangoApiAuth')).default;
                const operacoesBackend = await djangoApi.operacoes.getAll();
                
                console.log('✅ Operações carregadas do backend:', operacoesBackend);
                console.log('📊 Quantidade:', operacoesBackend.length);
                
                // Mapear campos do backend para o formato do frontend
                const operacoesMapeadas = operacoesBackend.map(op => {
                    const planoOperacional = op.plano_operacional || {};

                    const mapeada = {
                        ...op,
                        // Extrair data e hora se necessário
                        data_inicio: op.data_hora_inicio ? op.data_hora_inicio.split('T')[0] : '',
                        hora_inicio: op.data_hora_inicio ? op.data_hora_inicio.split('T')[1]?.substring(0, 5) : '',
                        hora_fim: op.data_hora_fim ? op.data_hora_fim.split('T')[1]?.substring(0, 5) : '',
                        status_dto: op.status,
                        departamento: op.departamento_solicitante_nome || `Dept ${op.departamento_solicitante}`,
                        departamento_solicitante_sigla: op.departamento_solicitante_nome || `Dept ${op.departamento_solicitante}`,
                        orgao_solicitante: op.departamento_solicitante_nome || `Dept ${op.departamento_solicitante}`,
                        departamento_demandante: op.departamento_solicitante_nome || `Dept ${op.departamento_solicitante}`,
                        responsavel_alvos: op.departamento_solicitante_nome || `Dept ${op.departamento_solicitante}`,
                        total_equipes: op.total_equipes || 0,
                        delegacia_responsavel: op.local_concentracao || 'A definir',
                        plano_operacional: planoOperacional,
                        planoOperacional,
                        numeroOperacao: planoOperacional.numeroPlano || op.id,
                        nup: planoOperacional.nupOficioEmail || '',
                        tipoMandado: planoOperacional.tipoMandado || '',
                        localApresentacao: planoOperacional.localApresentacao || op.local_concentracao || 'A definir',
                        diretor: planoOperacional.diretor || '',
                        diretorDemandante: planoOperacional.diretorDemandante || '',
                        departamentoDemandante: planoOperacional.departamentoDemandante || (op.departamento_solicitante_nome || `Dept ${op.departamento_solicitante}`),
                        local: planoOperacional.ondeOcorrera || op.objetivo || '',
                    };
                    
                    console.log(`📋 Operação ${op.id}: ${op.nome} - Status: ${op.status}`);
                    return mapeada;
                });
                
                setOperations(operacoesMapeadas);
                console.log(`✅ ${operacoesMapeadas.length} operações mapeadas e carregadas`);
                return;
            } catch (backendError) {
                console.warn('⚠️ Erro ao carregar do backend, usando mock:', backendError);
                // Se falhar, usar mock
            }
            
            // Mock temporário - operações de diferentes departamentos
            setOperations([
                { 
                    id: 1, 
                    nome: 'Operação Cerco', 
                    status: 'Aguardando Análise DTO', 
                    status_dto: 'Aguardando Análise DTO',
                    tipo_operacao: 'Com Apoio', 
                    data_inicio: '2025-12-20',
                    hora_inicio: '08:00',
                    hora_fim: '18:00',
                    orgao_solicitante: 'DHPP',
                    departamento_solicitante: 'DHPP',
                    departamento_solicitante_sigla: 'DHPP', 
                    departamento: 'DHPP',
                    delegacia_responsavel: '1ª DP Metropolitana',
                    objetivo: 'Combate ao tráfico de drogas na região metropolitana',
                    total_equipes: 5,
                    precisa_apoio_operacional: true,
                    apoio_operacional_dpc: 2,
                    apoio_operacional_oip: 8
                },
                { 
                    id: 2, 
                    nome: 'Operação Resgate', 
                    status: 'Aguardando Análise DTO', 
                    status_dto: 'Aguardando Análise DTO',
                    tipo_operacao: 'Com Apoio', 
                    data_inicio: '2026-01-14',
                    hora_inicio: '04:00',
                    hora_fim: '04:00',
                    orgao_solicitante: 'DPM',
                    departamento_solicitante: 'DPM',
                    departamento_solicitante_sigla: 'DPM', 
                    departamento: 'DPM',
                    delegacia_responsavel: '1ª Delegacia de Polícia Civil de Caucaia',
                    objetivo: 'Operação de resgate',
                    total_equipes: 10,
                    precisa_apoio_operacional: true,
                    efetivo_interno_dpc: 0,
                    efetivo_interno_oip: 30,
                    apoio_operacional_dpc: 0,
                    apoio_operacional_oip: 30,
                    apoio_cartorario_dpc: 0,
                    apoio_cartorario_oip: 0
                },
                { 
                    id: 3, 
                    nome: 'Operação Fortaleza Segura', 
                    status: 'Aprovada pelo DTO', 
                    status_dto: 'Aprovado DTO',
                    tipo_operacao: 'Interna', 
                    data_inicio: '2025-12-18',
                    hora_inicio: '06:00',
                    hora_fim: '18:00',
                    orgao_solicitante: 'DHPP',
                    departamento_solicitante: 'DHPP',
                    departamento_solicitante_sigla: 'DHPP', 
                    departamento: 'DHPP', 
                    delegacia_responsavel: 'DHPP - Sede',
                    objetivo: 'Investigação de homicídios',
                    total_equipes: 3 
                },
                { 
                    id: 4, 
                    nome: 'Operação Protetor', 
                    status: 'Em Execução', 
                    status_dto: 'Aprovado DTO',
                    tipo_operacao: 'Com Apoio', 
                    data_inicio: '2025-12-16',
                    hora_inicio: '14:00',
                    hora_fim: '22:00',
                    orgao_solicitante: 'DEPATRI',
                    departamento_solicitante: 'DEPATRI',
                    departamento_solicitante_sigla: 'DEPATRI', 
                    departamento: 'DEPATRI',
                    delegacia_responsavel: 'DEPATRI - Sede',
                    objetivo: 'Recuperação de patrimônio roubado',
                    total_equipes: 8 
                },
                { 
                    id: 5, 
                    nome: 'Operação Maracanaú Seguro', 
                    status: 'Aprovada pelo DTO', 
                    status_dto: 'Aprovado DTO',
                    tipo_operacao: 'Interna', 
                    data_inicio: '2026-01-15',
                    hora_inicio: '08:00',
                    hora_fim: '16:00',
                    orgao_solicitante: 'DPM',
                    departamento_solicitante: 'DPM',
                    departamento_solicitante_sigla: 'DPM', 
                    departamento: 'DPM',
                    delegacia_responsavel: '3ª DPM - Maracanaú',
                    objetivo: 'Policiamento ostensivo preventivo',
                    total_equipes: 6 
                },
                { 
                    id: 6, 
                    nome: 'Operação Resgate - Planejamento', 
                    status: 'Aprovada pelo DTO', 
                    status_dto: 'Aprovado DTO',
                    tipo_operacao: 'Com Apoio', 
                    data_inicio: '2026-01-14',
                    hora_inicio: '04:00',
                    hora_fim: '04:00',
                    orgao_solicitante: 'DPM',
                    departamento_solicitante: 'DPM',
                    departamento_solicitante_sigla: 'DPM', 
                    departamento: 'DPM',
                    delegacia_responsavel: '1ª Delegacia de Polícia Civil de Caucaia',
                    objetivo: 'Operação de resgate',
                    total_equipes: 10,
                    precisa_apoio_operacional: true,
                    efetivo_interno_dpc: 0,
                    efetivo_interno_oip: 30,
                    apoio_operacional_dpc: 0,
                    apoio_operacional_oip: 30,
                    apoio_cartorario_dpc: 0,
                    apoio_cartorario_oip: 0,
                    responsavel_operacao: 'DTO',
                    departamento_demandante: 'DPM',
                    responsavel_alvos: 'DPM'
                }
            ]);
        } catch (error) {
            console.error('❌ Erro ao carregar operações:', error);
            showNotification('Erro ao carregar operações', 'error');
        } finally {
            setLoading(false);
        }
    };

    const loadStats = () => {
        const aguardandoAprovacao = operations.filter(op => 
            op.status_dto === 'Aguardando Análise DTO' || 
            op.status === 'Aguardando Análise DTO' ||
            op.status === 'Aguardando Aprovação'
        ).length;
        
        const aprovadas = operations.filter(op => 
            op.status_dto === 'Aprovado DTO' || 
            op.status === 'Aprovada pelo DTO'
        ).length;
        
        const emExecucao = operations.filter(op => 
            op.status === 'Em Execução'
        ).length;
        
        const concluidas = operations.filter(op => 
            op.status === 'Concluída'
        ).length;
        
        setStats({ aguardandoAprovacao, aprovadas, emExecucao, concluidas });
        
        // Debug
        console.log('📊 Stats Atualizadas:', { aguardandoAprovacao, aprovadas, emExecucao, concluidas });
    };

    const handleSubmitNovaDemanda = async (e) => {
        e.preventDefault();
        
        try {
            // Importar dinamicamente o djangoApiAuth
            const djangoApi = (await import('../../services/djangoApiAuth')).default;
            
            // Mapear dados do formulário para o formato do backend Django
            const dataHoraInicio = `${formData.data_inicio}T${formData.hora_inicio || '08:00'}:00`;
            const dataHoraFim = formData.hora_fim ? `${formData.data_inicio}T${formData.hora_fim}:00` : null;
            
            // Buscar departamentos para pegar o ID correto
            let departamentoId = 1; // Default
            try {
                const departamentos = await djangoApi.departamentos.getAll();
                const dept = departamentos.find(d => 
                    d.sigla === formData.orgao_solicitante || 
                    d.nome.includes(formData.orgao_solicitante)
                );
                if (dept) {
                    departamentoId = dept.id;
                    console.log(`✅ Departamento encontrado: ${dept.nome} (ID: ${dept.id})`);
                } else {
                    console.warn(`⚠️ Departamento não encontrado: ${formData.orgao_solicitante}, usando ID 1`);
                }
            } catch (deptError) {
                console.warn('⚠️ Erro ao buscar departamentos:', deptError);
            }
            
            const operacaoData = {
                nome: formData.nome,
                departamento_solicitante: departamentoId,
                tipo_operacao: formData.precisa_apoio_operacional ? 'Com Apoio' : 'Interna',
                objetivo: formData.objetivo || 'Sem descrição',
                data_hora_inicio: dataHoraInicio,
                data_hora_fim: dataHoraFim,
                data_hora_briefing: dataHoraInicio, // Usar mesmo horário por enquanto
                local_concentracao: formData.locais_briefing[0] || 'A definir',
                status: formData.precisa_apoio_dto ? 'Aguardando Aprovação' : 'Aprovada pelo DTO',
                // Campos opcionais removidos (serão preenchidos automaticamente pelo backend)
            };

            console.log('📤 Enviando operação para o backend:', operacaoData);
            
            // Criar operação no backend
            const response = await djangoApi.operacoes.create(operacaoData);
            
            console.log('✅ Operação criada no backend:', response);
            
            // Adicionar ao estado local com campos extras do formulário
            const novaOperacao = {
                ...response,
                departamento_demandante: userDepartamento,
                departamento_solicitante_nome: formData.orgao_solicitante,
                delegacia_responsavel: formData.delegacia_responsavel,
                data_inicio: formData.data_inicio,
                hora_inicio: formData.hora_inicio,
                hora_fim: formData.hora_fim,
                status_dto: response.status,
                departamento: formData.orgao_solicitante,
                departamento_solicitante_sigla: formData.orgao_solicitante,
                orgao_solicitante: formData.orgao_solicitante,
                ...formData
            };

            setOperations(prev => [...prev, novaOperacao]);
            
            showNotification(
                formData.precisa_apoio_dto 
                    ? 'Operação criada! Aguardando aprovação do DTO. Você poderá cadastrar alvos após aprovação.'
                    : 'Operação criada com sucesso no backend!', 
                'success'
            );
            
            // Resetar formulário
            setFormData({
                nome: '',
                orgao_solicitante: '',
                delegacia_responsavel: '',
                data_inicio: '',
                hora_inicio: '08:00',
                hora_fim: '18:00',
                status_dto: 'Aguardando Análise DTO',
                objetivo: '',
                locais_briefing: [''],
                tipos_penais: [],
                tipo_penal_outros: '',
                modalidades: { busca_apreensao: 0, prisao_preventiva: 0, prisao_temporaria: 0, sequestro_bens: 0 },
                modalidade_outros: '',
                ais_locais: [],
                faccoes: [],
                faccao_outros: '',
                alvos_sensiveis: [],
                alvos_sensiveis_outros: '',
                apoio_outros_departamentos: '',
                apoio_operacional_dpc: 0,
                apoio_operacional_oip: 0,
                apoio_cartorario_dpc: 0,
                apoio_cartorario_oip: 0,
                orgaos_apoio: [],
                efetivo_interno_dpc: 0,
                efetivo_interno_oip: 0,
                precisa_apoio_dto: false,
                precisa_apoio_operacional: false,
                departamento_demandante: userDepartamento || '',
                responsavel_alvos: userDepartamento || ''
            });
            
            setActiveViewAndSyncUrl('dashboard');
            await loadOperations(); // Recarregar operações do backend
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao criar operação:', error);
            showNotification('Erro ao criar operação: ' + error.message, 'error');
            return false;
        }
    };

    const handleAprovarOperacao = async (operacaoId) => {
        try {
            // Atualizar no backend
            const djangoApi = (await import('../../services/djangoApiAuth')).default;
            await djangoApi.operacoes.update(operacaoId, {
                status: 'Aprovada pelo DTO'
            });
            
            // Atualizar estado local
            setOperations(prev => prev.map(op => 
                op.id === operacaoId 
                    ? { 
                        ...op, 
                        status_dto: 'Aprovado DTO', 
                        status: 'Aprovada pelo DTO',
                        // DTO assume a operação mas o departamento demandante continua responsável pelos alvos
                        responsavel_operacao: 'DTO'
                    }
                    : op
            ));
            
            showNotification('Operação aprovada! O departamento demandante pode agora cadastrar os alvos.', 'success');
            console.log('✅ Operação aprovada no backend:', operacaoId);
        } catch (error) {
            console.error('❌ Erro ao aprovar operação:', error);
            showNotification('Erro ao aprovar operação: ' + error.message, 'error');
        }
    };

    const handleRejeitarOperacao = async (operacaoId, motivo) => {
        try {
            // Atualizar no backend
            const djangoApi = (await import('../../services/djangoApiAuth')).default;
            await djangoApi.operacoes.update(operacaoId, {
                status: 'Reprovada pelo DTO',
                motivo_reprovacao: motivo
            });
            
            // Atualizar estado local
            setOperations(prev => prev.map(op => 
                op.id === operacaoId 
                    ? { ...op, status_dto: 'Rejeitado DTO', status: 'Reprovada pelo DTO', motivo_rejeicao: motivo }
                    : op
            ));
            
            showNotification('Operação rejeitada', 'info');
            console.log('✅ Operação rejeitada no backend:', operacaoId);
        } catch (error) {
            console.error('❌ Erro ao rejeitar operação:', error);
            showNotification('Erro ao rejeitar operação: ' + error.message, 'error');
        }
    };

    const handleVincularAlvoEquipe = (alvoId, equipesIds) => {
        setAlvos(prev => prev.map(alvo =>
            alvo.id === alvoId
                ? { ...alvo, equipesVinculadas: equipesIds }
                : alvo
        ));
        showNotification('Vinculação salva com sucesso!', 'success');
    };

    const handleRegistrarInformacoesAlvo = (dados) => {
        const alvoId = dados.alvoId;
        const novaInformacao = {
            ...dados,
            registradoPor: userData?.nome || userData?.displayName || 'Usuário',
            emailPolicial: userData?.email || ''
        };

        setInformacoesAlvos(prev => ({
            ...prev,
            [alvoId]: [...(prev[alvoId] || []), novaInformacao]
        }));

        console.log('📝 Nova informação registrada para alvo:', alvoId, novaInformacao);
    };

    // Menu lateral
    const MenuItem = ({ icon, label, active, onClick, collapsed, badge }) => (
        <button
            onClick={onClick}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'justify-between'} px-4 py-3 hover:bg-gray-800 transition-colors ${active ? 'bg-gray-800 border-l-4 border-cyan-500' : ''}`}
        >
            <div className="flex items-center space-x-3">
                <span className={active ? 'text-cyan-400' : 'text-gray-400'}>{icon}</span>
                {!collapsed && <span className={`${active ? 'text-white font-semibold' : 'text-gray-300'}`}>{label}</span>}
            </div>
            {!collapsed && badge > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">{badge}</span>
            )}
        </button>
    );

    const renderSidebar = () => (
        <div className={`fixed left-0 top-0 h-full bg-gray-900 transition-all duration-300 z-50 ${sidebarOpen ? 'w-64' : 'w-16'}`}>
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                {sidebarOpen && <h2 className="text-lg font-bold text-white">Painel de guerrilha</h2>}
                <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-gray-400 hover:text-white">
                    {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
            </div>

            <nav className="mt-4">
                {(isDTO || isDepartamento) && (
                    <>
                        <MenuItem icon={<LayoutDashboard size={20} />} label="Dashboard" active={activeView === 'dashboard'} onClick={() => setActiveViewAndSyncUrl('dashboard')} collapsed={!sidebarOpen} />
                        <MenuItem icon={<Plus size={20} />} label="Nova Demanda" active={activeView === 'nova-demanda'} onClick={() => setActiveViewAndSyncUrl('nova-demanda')} collapsed={!sidebarOpen} />
                        {isDTO && (
                            <MenuItem icon={<CheckCircle size={20} />} label="Aprovações" active={activeView === 'aprovacao'} onClick={() => setActiveViewAndSyncUrl('aprovacao')} collapsed={!sidebarOpen} badge={stats.aguardandoAprovacao} />
                        )}
                        <MenuItem icon={<Users size={20} />} label="Equipes" active={activeView === 'equipes'} onClick={() => setActiveViewAndSyncUrl('equipes')} collapsed={!sidebarOpen} />
                        {stats.aprovadas > 0 && (
                            <MenuItem icon={<ClipboardList size={20} />} label="Planejamento" active={activeView === 'planejamento'} onClick={() => setActiveViewAndSyncUrl('planejamento')} collapsed={!sidebarOpen} badge={stats.aprovadas} />
                        )}
                        <MenuItem icon={<Target size={20} />} label="Vincular Alvos" active={activeView === 'vincular-alvos'} onClick={() => setActiveViewAndSyncUrl('vincular-alvos')} collapsed={!sidebarOpen} />
                    </>
                )}
                <MenuItem icon={<FileText size={20} />} label="Frequência Operacional" active={activeView === 'relatorio'} onClick={() => setActiveViewAndSyncUrl('relatorio')} collapsed={!sidebarOpen} />
                <MenuItem icon={<FileText size={20} />} label="Relatório" active={activeView === 'relatorio-operacao'} onClick={() => setActiveViewAndSyncUrl('relatorio-operacao')} collapsed={!sidebarOpen} />
                {isPolicialOperacional && (
                    <MenuItem icon={<Target size={20} />} label="Meus Alvos" active={activeView === 'meus-alvos'} onClick={() => setActiveViewAndSyncUrl('meus-alvos')} collapsed={!sidebarOpen} />
                )}
                {(isDTO || isDepartamento) && (
                    <>
                        <MenuItem icon={<BarChart size={20} />} label="Estatísticas" active={activeView === 'estatisticas'} onClick={() => setActiveViewAndSyncUrl('estatisticas')} collapsed={!sidebarOpen} />
                    </>
                )}
            </nav>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen bg-gray-800">
            {renderSidebar()}

            <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
                {/* Conteúdo Principal */}
                <div className="p-6">
                    {(isDTO || isDepartamento) && activeView === 'dashboard' && (
                        <DashboardView 
                            stats={stats} 
                            operations={operacoesDoPolicialAtual} 
                            setSelectedOperation={setSelectedOperation} 
                            setActiveView={setActiveViewAndSyncUrl} 
                        />
                    )}
                    {(isDTO || isDepartamento) && activeView === 'nova-demanda' && (
                        <NovaDemandaView 
                            formData={formData} 
                            setFormData={setFormData} 
                            handleSubmit={handleSubmitNovaDemanda}
                            showNotification={showNotification}
                            userDepartamento={userDepartamento}
                        />
                    )}
                    {(isDTO || isDepartamento) && activeView === 'planejamento' && (
                        <PlanejamentoView 
                            operations={operacoesDoPolicialAtual}
                            selectedOperationId={selectedOperationId}
                            setSelectedOperationId={setSelectedOperationId}
                            stats={stats}
                            showEquipeForm={showEquipeForm}
                            setShowEquipeForm={setShowEquipeForm}
                            showAlvoForm={showAlvoForm}
                            setShowAlvoForm={setShowAlvoForm}
                            showPlanoForm={showPlanoForm}
                            setShowPlanoForm={setShowPlanoForm}
                            equipes={equipes}
                            setEquipes={setEquipes}
                            alvos={alvos}
                            setAlvos={setAlvos}
                            draggedAlvo={draggedAlvo}
                            setDraggedAlvo={setDraggedAlvo}
                            showNotification={showNotification}
                            equipeForm={equipeForm}
                            setEquipeForm={setEquipeForm}
                            alvoForm={alvoForm}
                            setAlvoForm={setAlvoForm}
                            planoForm={planoForm}
                            setPlanoForm={setPlanoForm}
                            setOperacoes={setOperations}
                            userDepartamento={userDepartamento}
                            isDTO={isDTO}
                        />
                    )}
                    {activeView === 'relatorio' && (
                        <RelatorioView 
                            operations={operations}
                            equipes={equipes}
                            isPolicialOperacional={isPolicialOperacional}
                            equipesDoPolicialAtual={equipesDoPolicialAtual}
                            selectedOperationRelatorio={selectedOperationRelatorio}
                            setSelectedOperationRelatorio={setSelectedOperationRelatorio}
                            policiaisPresenca={policiaisPresenca}
                            setPoliciaisPresenca={setPoliciaisPresenca}
                            showNotification={showNotification}
                            setShowSubstituicaoModal={setShowSubstituicaoModal}
                            setEquipes={setEquipes}
                            userData={userData}
                        />
                    )}
                    {activeView === 'relatorio-operacao' && (
                        <ResultadosOperacaoView
                            operations={operations}
                            isPolicialOperacional={isPolicialOperacional}
                            equipesDoPolicialAtual={equipesDoPolicialAtual}
                            resultadosOperacao={resultadosOperacao}
                            setResultadosOperacao={setResultadosOperacao}
                            showNotification={showNotification}
                        />
                    )}
                    {isPolicialOperacional && activeView === 'meus-alvos' && (
                        <MeusAlvosView 
                            alvosDoPolicialAtual={alvosDoPolicialAtual}
                            equipesDoPolicialAtual={equipesDoPolicialAtual}
                            showNotification={showNotification}
                            onRegistrarInformacoes={handleRegistrarInformacoesAlvo}
                        />
                    )}
                    {(isDTO || isDepartamento) && activeView === 'estatisticas' && (
                        <EstatisticasView 
                            operations={operacoesDoPolicialAtual}
                            equipes={equipesDoPolicialAtual}
                            alvos={alvosDoPolicialAtual}
                            stats={stats}
                        />
                    )}
                    {isDTO && activeView === 'aprovacao' && (
                        <AprovacaoDTO
                            operations={operations}
                            showNotification={showNotification}
                            onAprovar={handleAprovarOperacao}
                            onRejeitar={handleRejeitarOperacao}
                        />
                    )}
                    {(isDTO || isDepartamento) && activeView === 'vincular-alvos' && (
                        <VincularAlvosEquipes
                            operacoes={operations}
                            equipes={equipes}
                            alvos={alvos}
                            onVincular={handleVincularAlvoEquipe}
                            showNotification={showNotification}
                        />
                    )}
                    {(isDTO || isDepartamento) && activeView === 'equipes' && (
                        <div className="bg-gray-700 p-6 rounded-lg">
                            <h2 className="text-2xl font-bold text-white mb-6">
                                {isDTO ? 'Solicitação de Equipes' : 'Minhas Solicitações de Equipes'}
                            </h2>
                            
                            {/* DTO: Criar Solicitação */}
                            {isDTO && (
                                <div className="mb-8 bg-gray-800 p-6 rounded-lg border border-cyan-500">
                                    <h3 className="text-xl font-bold text-cyan-400 mb-4">Nova Solicitação</h3>
                                    <form onSubmit={(e) => {
                                        e.preventDefault();
                                        const formData = new FormData(e.target);
                                        const novaSolicitacao = {
                                            id: Date.now(),
                                            operacaoId: formData.get('operacao'),
                                            operacaoNome: operations.find(op => op.id === parseInt(formData.get('operacao')))?.nome,
                                            departamentoDestino: formData.get('departamento'),
                                            quantidadeEquipes: parseInt(formData.get('quantidade')),
                                            status: 'Pendente',
                                            dataEnvio: new Date().toISOString(),
                                            equipesAlocadas: []
                                        };
                                        
                                        // Salvar no localStorage
                                        const solicitacoes = JSON.parse(localStorage.getItem('solicitacoesEquipes') || '[]');
                                        solicitacoes.push(novaSolicitacao);
                                        localStorage.setItem('solicitacoesEquipes', JSON.stringify(solicitacoes));
                                        
                                        showNotification(`Solicitação enviada para ${formData.get('departamento')}!`, 'success');
                                        e.target.reset();
                                        window.location.reload();
                                    }}>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-300 mb-2">Operação</label>
                                                <select name="operacao" required className="w-full bg-gray-700 text-white rounded px-4 py-2 border border-gray-500">
                                                    <option value="">Selecione...</option>
                                                    {operations.filter(op => op.status === 'Aprovada pelo DTO').map(op => (
                                                        <option key={op.id} value={op.id}>{op.nome}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-300 mb-2">Departamento</label>
                                                <select name="departamento" required className="w-full bg-gray-700 text-white rounded px-4 py-2 border border-gray-500">
                                                    <option value="">Selecione...</option>
                                                    <option value="DHPP">DHPP</option>
                                                    <option value="DPM">DPM</option>
                                                    <option value="DRE">DRE</option>
                                                    <option value="DRFR">DRFR</option>
                                                    <option value="DCIP">DCIP</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-bold text-gray-300 mb-2">Qtd. Equipes</label>
                                                <input type="number" name="quantidade" min="1" required className="w-full bg-gray-700 text-white rounded px-4 py-2 border border-gray-500" />
                                            </div>
                                        </div>
                                        <button type="submit" className="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-6 rounded-lg">
                                            Enviar Solicitação
                                        </button>
                                    </form>
                                </div>
                            )}
                            
                            {/* Lista de Solicitações */}
                            <div className="space-y-4">
                                {(() => {
                                    const todasSolicitacoes = JSON.parse(localStorage.getItem('solicitacoesEquipes') || '[]');
                                    const solicitacoesFiltradas = isDepartamento 
                                        ? todasSolicitacoes.filter(s => s.departamentoDestino === userDepartamento)
                                        : todasSolicitacoes;
                                    
                                    if (solicitacoesFiltradas.length === 0) {
                                        return (
                                            <div className="text-center py-12">
                                                <p className="text-gray-400 text-lg">
                                                    {isDepartamento ? 'Nenhuma solicitação recebida' : 'Nenhuma solicitação enviada'}
                                                </p>
                                            </div>
                                        );
                                    }
                                    
                                    return solicitacoesFiltradas.map((solicitacao) => (
                                        <div key={solicitacao.id} className="bg-gray-800 p-5 rounded-lg border-l-4 border-cyan-500">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-lg font-bold text-white">{solicitacao.operacaoNome}</h3>
                                                    <p className="text-sm text-gray-400">
                                                        Para: <span className="font-semibold text-cyan-400">{solicitacao.departamentoDestino}</span>
                                                    </p>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                                    solicitacao.status === 'Completa' ? 'bg-green-600 text-white' :
                                                    solicitacao.status === 'Parcial' ? 'bg-yellow-600 text-white' :
                                                    'bg-orange-600 text-white'
                                                }`}>
                                                    {solicitacao.status}
                                                </span>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                <div>
                                                    <p className="text-xs text-gray-500">Equipes Solicitadas</p>
                                                    <p className="text-2xl font-bold text-white">{solicitacao.quantidadeEquipes}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500">Equipes Alocadas</p>
                                                    <p className="text-2xl font-bold text-cyan-400">{solicitacao.equipesAlocadas.length}</p>
                                                </div>
                                            </div>
                                            
                                            {/* Departamento: Alocar Equipes */}
                                            {isDepartamento && solicitacao.equipesAlocadas.length < solicitacao.quantidadeEquipes && (
                                                <form onSubmit={(e) => {
                                                    e.preventDefault();
                                                    const formData = new FormData(e.target);
                                                    
                                                    // Coletar dados dos policiais
                                                    const policiais = [];
                                                    let lider = null;
                                                    
                                                    for (let i = 1; i <= 4; i++) {
                                                        const matricula = formData.get(`policial${i}_matricula`);
                                                        const nome = formData.get(`policial${i}_nome`);
                                                        
                                                        if (matricula && nome) {
                                                            const policial = {
                                                                matricula,
                                                                nome,
                                                                isLider: formData.get(`policial${i}_lider`) === 'on'
                                                            };
                                                            
                                                            if (policial.isLider) lider = nome;
                                                            policiais.push(policial);
                                                        }
                                                    }
                                                    
                                                    const novaEquipe = {
                                                        id: Date.now(),
                                                        departamento: formData.get('departamento'),
                                                        delegacia: formData.get('delegacia'),
                                                        chefe: lider || policiais[0]?.nome,
                                                        viatura: formData.get('viatura'),
                                                        membros: policiais.map(p => p.nome),
                                                        policiais: policiais,
                                                        operacaoId: solicitacao.operacaoId
                                                    };
                                                    
                                                    // Atualizar solicitação
                                                    const solicitacoes = JSON.parse(localStorage.getItem('solicitacoesEquipes') || '[]');
                                                    const index = solicitacoes.findIndex(s => s.id === solicitacao.id);
                                                    solicitacoes[index].equipesAlocadas.push(novaEquipe);
                                                    
                                                    // Atualizar status
                                                    if (solicitacoes[index].equipesAlocadas.length >= solicitacoes[index].quantidadeEquipes) {
                                                        solicitacoes[index].status = 'Completa';
                                                    } else {
                                                        solicitacoes[index].status = 'Parcial';
                                                    }
                                                    
                                                    localStorage.setItem('solicitacoesEquipes', JSON.stringify(solicitacoes));
                                                    
                                                    // Adicionar às equipes gerais
                                                    const equipesAtuais = equipes;
                                                    equipesAtuais.push(novaEquipe);
                                                    setEquipes(equipesAtuais);
                                                    
                                                    showNotification('Equipe alocada com sucesso!', 'success');
                                                    window.location.reload();
                                                }} className="bg-gray-700 p-6 rounded border border-cyan-500 mt-4">
                                                    <h4 className="font-bold text-white mb-1 text-lg flex items-center">
                                                        🚔 Equipes Operacionais
                                                    </h4>
                                                    <p className="text-sm text-gray-400 mb-4">Efetivo de 3 a 4 policiais</p>
                                                    
                                                    {/* Dados da Equipe */}
                                                    <div className="bg-gray-800 p-4 rounded mb-4">
                                                        <h5 className="font-bold text-cyan-400 mb-3">Dados da Equipe</h5>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <label className="block text-sm font-semibold text-gray-300 mb-2">
                                                                    Departamento <span className="text-red-500">*</span>
                                                                </label>
                                                                <input 
                                                                    type="text" 
                                                                    name="departamento" 
                                                                    value={userDepartamento}
                                                                    readOnly
                                                                    className="w-full bg-gray-900 text-gray-400 rounded px-3 py-2 border border-gray-600"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-sm font-semibold text-gray-300 mb-2">
                                                                    Delegacia/Unidade <span className="text-red-500">*</span>
                                                                </label>
                                                                <select 
                                                                    name="delegacia" 
                                                                    required
                                                                    className="w-full bg-gray-900 text-white rounded px-3 py-2 border border-gray-600 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                                                                >
                                                                    <option value="">Selecione a delegacia</option>
                                                                    {userDepartamento && DEPARTMENTS[userDepartamento] ? 
                                                                        DEPARTMENTS[userDepartamento].map(delegacia => (
                                                                            <option key={delegacia} value={delegacia}>{delegacia}</option>
                                                                        ))
                                                                    : null}
                                                                </select>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3">
                                                            <label className="block text-sm font-semibold text-gray-300 mb-2">Placa da Viatura</label>
                                                            <input 
                                                                type="text" 
                                                                name="viatura" 
                                                                placeholder="ABC-1234"
                                                                required
                                                                className="w-full bg-gray-900 text-white rounded px-3 py-2 border border-gray-600"
                                                            />
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Policiais */}
                                                    <div className="bg-gray-800 p-4 rounded">
                                                        <h5 className="font-bold text-cyan-400 mb-3 flex items-center">
                                                            👮 OIP - Oficiais de Investigação Policial
                                                        </h5>
                                                        
                                                        {[1, 2, 3, 4].map(num => (
                                                            <div key={num} className="mb-4 pb-4 border-b border-gray-700 last:border-0">
                                                                <p className="text-sm font-semibold text-gray-300 mb-2">
                                                                    Policial {num} {num <= 3 && <span className="text-red-500">*</span>}
                                                                    {num === 4 && <span className="text-gray-500 text-xs ml-2">(Opcional)</span>}
                                                                </p>
                                                                <div className="grid grid-cols-12 gap-3">
                                                                    <div className="col-span-2 flex items-center">
                                                                        <label className="flex items-center space-x-2 cursor-pointer">
                                                                            <input 
                                                                                type="checkbox" 
                                                                                name={`policial${num}_lider`}
                                                                                className="w-4 h-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"
                                                                            />
                                                                            <span className="text-sm text-gray-400">Líder</span>
                                                                        </label>
                                                                    </div>
                                                                    <div className="col-span-4">
                                                                        <input 
                                                                            type="text" 
                                                                            name={`policial${num}_matricula`}
                                                                            placeholder="Matrícula"
                                                                            required={num <= 3}
                                                                            onChange={async (e) => {
                                                                                const matricula = e.target.value;
                                                                                const nome = await buscarPolicialPorMatricula(matricula);
                                                                                const matriculaInput = document.querySelector(`input[name="policial${num}_matricula"]`);
                                                                                if (matriculaInput && matriculaInput.value !== matricula) return;
                                                                                if (nome) {
                                                                                    const nomeInput = document.querySelector(`input[name="policial${num}_nome"]`);
                                                                                    if (nomeInput) {
                                                                                        nomeInput.value = nome;
                                                                                        nomeInput.classList.add('border-green-500', 'bg-green-900/20');
                                                                                    }
                                                                                } else {
                                                                                    const nomeInput = document.querySelector(`input[name="policial${num}_nome"]`);
                                                                                    if (nomeInput && matricula.length > 0) {
                                                                                        nomeInput.classList.remove('border-green-500', 'bg-green-900/20');
                                                                                    }
                                                                                }
                                                                            }}
                                                                            className="w-full bg-gray-900 text-white rounded px-3 py-2 text-sm border border-gray-600"
                                                                        />
                                                                    </div>
                                                                    <div className="col-span-6">
                                                                        <input 
                                                                            type="text" 
                                                                            name={`policial${num}_nome`}
                                                                            placeholder="Nome completo do policial"
                                                                            required={num <= 3}
                                                                            readOnly
                                                                            className="w-full bg-gray-900 text-white rounded px-3 py-2 text-sm border border-gray-600 cursor-not-allowed"
                                                                        />
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    
                                                    <button type="submit" className="w-full mt-4 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-lg transition-colors">
                                                        ✓ Adicionar Equipe à Operação
                                                    </button>
                                                </form>
                                            )}
                                            
                                            {/* Mostrar Equipes Alocadas */}
                                            {solicitacao.equipesAlocadas.length > 0 && (
                                                <div className="mt-4 space-y-2">
                                                    <p className="text-sm font-bold text-gray-300">Equipes Alocadas:</p>
                                                    {solicitacao.equipesAlocadas.map((eq, idx) => (
                                                        <div key={idx} className="bg-gray-900 p-3 rounded">
                                                            <div className="flex justify-between items-start">
                                                                <div>
                                                                    <p className="text-white font-semibold">{eq.chefe}</p>
                                                                    <p className="text-xs text-gray-400">{eq.delegacia} • {eq.viatura}</p>
                                                                </div>
                                                                {eq.membros.length > 0 && (
                                                                    <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">
                                                                        +{eq.membros.length} membros
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    )}
                    {isDTO && activeView === 'aprovacao' && (
                        <div className="bg-gray-700 p-6 rounded-lg">
                            <h2 className="text-2xl font-bold text-white mb-6">Aprovação de Operações</h2>
                            <p className="text-gray-400">Sistema em desenvolvimento...</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Substituição */}
            {showSubstituicaoModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
                        <h3 className="text-xl font-bold text-white mb-4">Substituir Policial</h3>
                        <p className="text-gray-300 mb-4">
                            Substituindo: <strong>{showSubstituicaoModal.policial}</strong>
                        </p>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const novoPolicial = e.target.novoPolicial.value;
                            
                            // Atualizar equipe
                            const equipesAtualizadas = equipes.map(eq => {
                                if (eq.id === showSubstituicaoModal.equipeId) {
                                    if (eq.chefe === showSubstituicaoModal.policial) {
                                        return { ...eq, chefe: novoPolicial };
                                    } else {
                                        return {
                                            ...eq,
                                            membros: eq.membros.map(m => 
                                                m === showSubstituicaoModal.policial ? novoPolicial : m
                                            )
                                        };
                                    }
                                }
                                return eq;
                            });
                            setEquipes(equipesAtualizadas);
                            
                            showNotification(`Policial substituído: ${showSubstituicaoModal.policial} → ${novoPolicial}`, 'success');
                            setShowSubstituicaoModal(false);
                        }}>
                            <input
                                type="text"
                                name="novoPolicial"
                                required
                                placeholder="Nome do novo policial"
                                className="w-full bg-gray-700 text-white rounded px-4 py-2 border border-gray-500 mb-4"
                            />
                            <div className="flex space-x-4">
                                <button
                                    type="button"
                                    onClick={() => setShowSubstituicaoModal(false)}
                                    className="flex-1 bg-gray-600 hover:bg-gray-700 py-2 rounded text-white"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 bg-orange-600 hover:bg-orange-700 py-2 rounded text-white"
                                >
                                    Confirmar Substituição
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
