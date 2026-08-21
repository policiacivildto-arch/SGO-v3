from django.db import models
from django.contrib.auth.models import User
from django.core.validators import RegexValidator
from django.utils import timezone


MATRICULA_VALIDATOR = RegexValidator(
    r'^\d{7}[\dX]$',
    'Matrícula deve ter 8 caracteres (7 números e o último pode ser X)'
)


class PasswordResetToken(models.Model):
    """Token temporário para redefinição de senha de usuário."""

    usuario = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token_hash = models.CharField(max_length=64, unique=True, db_index=True)
    expires_at = models.DateTimeField(db_index=True)
    used_at = models.DateTimeField(null=True, blank=True, db_index=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-criado_em']
        verbose_name = 'Token de Redefinição de Senha'
        verbose_name_plural = 'Tokens de Redefinição de Senha'

    @property
    def is_valid(self):
        return self.used_at is None and self.expires_at > timezone.now()

class Departamento(models.Model):
    """Departamentos da Polícia Civil (Delegacia de Polícia, Departamento Especializado, etc)"""
    nome = models.CharField(max_length=255, unique=True)
    sigla = models.CharField(max_length=10, unique=True)
    descricao = models.TextField(blank=True, null=True)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['nome']
        verbose_name_plural = 'Departamentos'

    def __str__(self):
        return self.nome


class Delegacia(models.Model):
    """Delegacias vinculadas a um Departamento"""
    nome = models.CharField(max_length=255)
    departamento = models.ForeignKey(Departamento, on_delete=models.CASCADE, related_name='delegacias')
    endereco = models.TextField(blank=True, null=True)
    telefone = models.CharField(max_length=20, blank=True, null=True)
    cidade = models.CharField(max_length=100, blank=True, null=True)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['departamento', 'nome']
        verbose_name_plural = 'Delegacias'
        unique_together = ('nome', 'departamento')

    def __str__(self):
        return f"{self.nome} ({self.departamento.sigla})"


class Policial(models.Model):
    """Cadastro de policiais da corporação"""
    CLASSES = (
        ('Praça', 'Praça'),
        ('Oficial', 'Oficial'),
    )

    CARGOS = (
        ('Policial Civil', 'Policial Civil'),
        ('Delegado', 'Delegado'),
        ('OIP', 'OIP'),
        ('Investigador', 'Investigador'),
    )

    usuario = models.OneToOneField(User, on_delete=models.CASCADE, related_name='policial')
    matricula = models.CharField(
        max_length=8,
        unique=True,
        validators=[MATRICULA_VALIDATOR]
    )
    nome = models.CharField(max_length=255)
    classe = models.CharField(max_length=20, choices=CLASSES)
    cargo = models.CharField(max_length=50, choices=CARGOS)
    delegacia = models.ForeignKey(Delegacia, on_delete=models.SET_NULL, null=True, related_name='policiais')
    telefone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(unique=True)
    ativo = models.BooleanField(default=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['nome']
        verbose_name_plural = 'Policiais'

    def __str__(self):
        return f"{self.nome} ({self.matricula})"


class RosterPolicial(models.Model):
    """
    Cadastro-base de matrícula/nome/cargo do efetivo, usado apenas para
    autocompletar formulários (cadastro, escalas) pela matrícula antes de
    o policial ter uma conta (Policial) no sistema.

    Diferente de Policial, não exige usuário vinculado. Consultado apenas
    por matrícula exata via API pública somente-leitura — nunca listado
    em massa, para não reexpor o cadastro completo do efetivo.
    """
    matricula = models.CharField(max_length=8, unique=True, db_index=True)
    nome = models.CharField(max_length=255)
    cargo = models.CharField(max_length=100, blank=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['nome']
        verbose_name = 'Policial do Roster'
        verbose_name_plural = 'Policiais do Roster'

    def __str__(self):
        return f"{self.nome} ({self.matricula})"


class Pagamento(models.Model):
    policial = models.ForeignKey('Policial', on_delete=models.CASCADE, related_name='pagamentos')
    data_operacao = models.DateField()
    horario_inicial = models.DateTimeField()
    horario_final = models.DateTimeField()
    valor_pago = models.DecimalField(max_digits=10, decimal_places=2)
    observacao = models.TextField(blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Pagamentos'
        ordering = ['-data_operacao', 'policial']

    def __str__(self):
        return f"Pagamento {self.policial.nome} - {self.data_operacao}"

class Viatura(models.Model):
    """Viaturas disponíveis para operações"""
    placa = models.CharField(
        max_length=8,
        unique=True,
        validators=[RegexValidator(r'^[A-Z]{3}-?\d{4}$', 'Placa inválida')]
    )
    modelo = models.CharField(max_length=100)
    ano = models.IntegerField()
    delegacia = models.ForeignKey(Delegacia, on_delete=models.SET_NULL, null=True, related_name='viaturas')
    ativa = models.BooleanField(default=True)
    km_atual = models.IntegerField(default=0)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['placa']
        verbose_name_plural = 'Viaturas'

    def __str__(self):
        return f"{self.placa} - {self.modelo}"


class Vaga(models.Model):
    """Vagas para escalação de equipes"""
    TURNO_CHOICES = (
        ('day', 'Diurno (08:00 - 20:00)'),
        ('night', 'Noturno (19:00 - 01:00)'),
    )

    data = models.DateField()
    turno = models.CharField(max_length=10, choices=TURNO_CHOICES)
    delegacia = models.ForeignKey(Delegacia, on_delete=models.CASCADE, related_name='vagas')
    posicoes_disponiveis = models.IntegerField(default=1)
    descricao = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, default='Disponível')  # Disponível, Ocupada, Cancelada
    restrito_adm_cadastra = models.BooleanField(default=False)  # Somente ADM pode cadastrar equipe nesta vaga
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['data', 'turno']
        unique_together = ('data', 'turno', 'delegacia', 'restrito_adm_cadastra')

    def __str__(self):
        return f"Vaga {self.delegacia.nome} - {self.data} ({self.turno})"


class Equipe(models.Model):
    """Equipes formadas para serviços/operações"""
    STATUS_CHOICES = (
        ('Em Análise', 'Em Análise'),
        ('Aprovada', 'Aprovada'),
        ('Pendente (Conflito)', 'Pendente (Conflito)'),
        ('Rejeitada', 'Rejeitada'),
    )

    vaga = models.ForeignKey(Vaga, on_delete=models.CASCADE, related_name='equipes')
    chefe = models.ForeignKey(Policial, on_delete=models.SET_NULL, null=True, related_name='equipes_lideradas')
    membros = models.ManyToManyField(Policial, related_name='equipes_participadas')
    viatura = models.ForeignKey(Viatura, on_delete=models.SET_NULL, null=True, blank=True, related_name='equipes')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Em Análise')
    telefone_contato = models.CharField(max_length=20, blank=True, null=True)
    observacoes = models.TextField(blank=True, null=True)
    data_criacao = models.DateTimeField(auto_now_add=True)
    data_aprovacao = models.DateTimeField(blank=True, null=True)
    aprovado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='equipes_aprovadas')

    class Meta:
        ordering = ['-data_criacao']

    def __str__(self):
        return f"Equipe {self.id} - {self.chefe.nome if self.chefe else 'Sem chefe'}"


class Operacao(models.Model):
    """Operações realizadas pelas equipes"""
    STATUS_CHOICES = (
        ('Planejada', 'Planejada'),
        ('Em Execução', 'Em Execução'),
        ('Concluída', 'Concluída'),
        ('Cancelada', 'Cancelada'),
    )

    data_inicio = models.DateTimeField()
    data_fim = models.DateTimeField(blank=True, null=True)
    equipe = models.ForeignKey(Equipe, on_delete=models.SET_NULL, null=True, related_name='operacoes')
    descricao = models.TextField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Planejada')
    ais = models.CharField(max_length=50, blank=True, null=True)  # Área Integrada de Segurança
    bairros = models.CharField(max_length=500, blank=True, null=True)  # Bairros envolvidos
    resultado = models.TextField(blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-data_inicio']

    def __str__(self):
        return f"Operação {self.id} - {self.descricao[:50]}"


class Comboio(models.Model):
    """Comboios (operações coordenadas com múltiplas equipes)"""
    STATUS_CHOICES = (
        ('Planejado', 'Planejado'),
        ('Em Andamento', 'Em Andamento'),
        ('Concluído', 'Concluído'),
        ('Cancelado', 'Cancelado'),
    )

    data = models.DateField()
    descricao = models.TextField()
    dpc = models.ForeignKey(Policial, on_delete=models.SET_NULL, null=True, blank=True, related_name='comboios_dpc')  # Delegado de Polícia Civil
    oip = models.ForeignKey(Policial, on_delete=models.SET_NULL, null=True, blank=True, related_name='comboios_oip')  # Oficial de Investigações de Polícia
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Planejado')
    ais = models.CharField(max_length=50, blank=True, null=True)
    bairros = models.CharField(max_length=500, blank=True, null=True)
    operacoes = models.ManyToManyField(Operacao, related_name='comboios', blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-data']

    def __str__(self):
        return f"Comboio {self.id} - {self.data}"


class FrequenciaPolicial(models.Model):
    """Registro de presença/falta/substituição de policiais nas operações (comboios)"""
    STATUS_CHOICES = (
        ('presente', 'Presente'),
        ('falta', 'Falta'),
        ('substituto', 'Substituto'),
        ('pendente', 'Pendente'),
    )

    equipe = models.ForeignKey(Equipe, on_delete=models.CASCADE, related_name='frequencias')
    policial = models.ForeignKey(Policial, on_delete=models.CASCADE, related_name='frequencias')
    data_operacao = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pendente')
    substituto = models.ForeignKey(
        Policial, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='frequencias_como_substituto'
    )
    registrado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-data_operacao']
        unique_together = ('equipe', 'policial', 'data_operacao')
        verbose_name = 'Frequência de Policial'
        verbose_name_plural = 'Frequências de Policiais'

    def __str__(self):
        return f"{self.policial.nome} - {self.data_operacao} ({self.status})"


# ===================================
# SISTEMA DE OPERAÇÕES
# ===================================

class OperacaoPolicial(models.Model):
    """Operação Policial Completa - Sistema de Gestão Operacional"""
    STATUS_CHOICES = (
        ('Rascunho', 'Rascunho'),
        ('Aguardando Aprovação', 'Aguardando Aprovação'),
        ('Aprovada pelo DTO', 'Aprovada pelo DTO'),
        ('Reprovada pelo DTO', 'Reprovada pelo DTO'),
        ('Em Execução', 'Em Execução'),
        ('Concluída', 'Concluída'),
        ('Cancelada', 'Cancelada'),
    )

    TIPO_CHOICES = (
        ('Interna', 'Operação Interna (Sem Apoio)'),
        ('Com Apoio', 'Operação com Apoio Externo'),
    )

    # Demanda
    nome = models.CharField(max_length=255)
    departamento_solicitante = models.ForeignKey(
        Departamento, 
        on_delete=models.CASCADE, 
        related_name='operacoes_solicitadas'
    )
    delegacia_solicitante = models.ForeignKey(
        Delegacia,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='operacoes_solicitadas',
        help_text='Delegacia que originou a demanda da operação'
    )
    tipo_operacao = models.CharField(max_length=20, choices=TIPO_CHOICES, default='Interna')
    objetivo = models.TextField()
    data_hora_inicio = models.DateTimeField()
    data_hora_fim = models.DateTimeField(blank=True, null=True)
    data_hora_briefing = models.DateTimeField(help_text="Data/hora do briefing - após isso, policiais podem ver alvos")
    
    # Planejamento
    local_concentracao = models.CharField(max_length=255, blank=True, null=True)
    plano_operacional = models.JSONField(default=dict, blank=True)
    responsavel_operacao = models.ForeignKey(
        Policial, 
        on_delete=models.SET_NULL, 
        null=True, 
        related_name='operacoes_responsavel'
    )
    
    # Apoio
    departamentos_apoio = models.ManyToManyField(
        Departamento, 
        related_name='operacoes_apoio', 
        blank=True,
        help_text="Departamentos convidados para apoiar"
    )
    
    # Status e Aprovação
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='Rascunho')
    aprovado_por = models.ForeignKey(
        User, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True, 
        related_name='operacoes_aprovadas'
    )
    data_aprovacao = models.DateTimeField(blank=True, null=True)
    motivo_reprovacao = models.TextField(blank=True, null=True)
    
    # Custos
    custo_planejado = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    custo_real = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    responsavel_custo = models.ForeignKey(
        Departamento,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='operacoes_custeadas',
        help_text="Departamento responsável pelo custo (Solicitante se interna, DTO se apoio)"
    )
    
    # Metadados
    criado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='operacoes_criadas')
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-data_hora_inicio']
        verbose_name = 'Operação Policial'
        verbose_name_plural = 'Operações Policiais'

    def __str__(self):
        return f"{self.nome} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        if self.delegacia_solicitante and self.delegacia_solicitante.departamento_id:
            self.departamento_solicitante = self.delegacia_solicitante.departamento

        # Lógica automática de alocação de custos
        if self.tipo_operacao == 'Interna':
            self.responsavel_custo = self.departamento_solicitante
        elif self.tipo_operacao == 'Com Apoio':
            # Precisa buscar o DTO - assumindo que existe um departamento com sigla 'DTO'
            dto = Departamento.objects.filter(sigla='DTO').first()
            if dto:
                self.responsavel_custo = dto
        super().save(*args, **kwargs)


class Alvo(models.Model):
    """Alvos de uma operação (pessoas ou locais) com dossiê anexado"""
    operacao = models.ForeignKey(OperacaoPolicial, on_delete=models.CASCADE, related_name='alvos')
    nome = models.CharField(max_length=255)
    tipo = models.CharField(max_length=50, choices=(
        ('Pessoa', 'Pessoa'),
        ('Local', 'Local/Endereço'),
        ('Veículo', 'Veículo'),
        ('Organização', 'Organização Criminosa'),
    ))
    descricao = models.TextField(blank=True, null=True)
    endereco = models.TextField(blank=True, null=True)
    
    # Dossiê (PDF)
    dossie_pdf = models.FileField(upload_to='dossies/', blank=True, null=True)
    
    # Controle de acesso
    visivel_apos_briefing = models.BooleanField(default=True, help_text="Se True, só visível após briefing")
    
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['nome']
        verbose_name_plural = 'Alvos'

    def __str__(self):
        return f"{self.nome} ({self.operacao.nome})"


class EquipeOperacao(models.Model):
    """Equipes designadas para uma operação específica"""
    operacao = models.ForeignKey(OperacaoPolicial, on_delete=models.CASCADE, related_name='equipes_operacao')
    departamento = models.ForeignKey(Departamento, on_delete=models.CASCADE, related_name='equipes_operacao')
    delegacia = models.ForeignKey(Delegacia, on_delete=models.SET_NULL, null=True, related_name='equipes_operacao')
    
    # Equipe
    chefe = models.ForeignKey(Policial, on_delete=models.SET_NULL, null=True, related_name='equipes_operacao_lider')
    membros = models.ManyToManyField(Policial, related_name='equipes_operacao_membro', blank=True)
    viatura = models.ForeignKey(Viatura, on_delete=models.SET_NULL, null=True, blank=True, related_name='equipes_operacao')
    
    # Execução
    confirmou_presenca = models.BooleanField(default=False)
    hora_retorno = models.DateTimeField(blank=True, null=True)
    
    observacoes = models.TextField(blank=True, null=True)
    criado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['departamento', 'delegacia']
        verbose_name = 'Equipe da Operação'
        verbose_name_plural = 'Equipes da Operação'

    def __str__(self):
        return f"Equipe {self.departamento.sigla} - {self.operacao.nome}"


class SubstitutoOperacao(models.Model):
    """Registro de substitutos que entraram no lugar de faltosos"""
    equipe = models.ForeignKey(EquipeOperacao, on_delete=models.CASCADE, related_name='substitutos')
    policial_planejado = models.ForeignKey(
        Policial, 
        on_delete=models.CASCADE, 
        related_name='substituicoes_planejadas'
    )
    policial_substituto = models.ForeignKey(
        Policial, 
        on_delete=models.CASCADE, 
        related_name='substituicoes_realizadas'
    )
    motivo = models.TextField(blank=True, null=True)
    registrado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Substituto'
        verbose_name_plural = 'Substitutos'

    def __str__(self):
        return f"{self.policial_substituto.nome} substitui {self.policial_planejado.nome}"


class ResultadoOperacao(models.Model):
    """Resultados obtidos durante a execução da operação"""
    TIPO_RESULTADO = (
        ('Prisão', 'Prisão'),
        ('Apreensão', 'Apreensão'),
        ('Mandado Cumprido', 'Mandado Cumprido'),
        ('Arma Apreendida', 'Arma Apreendida'),
        ('Droga Apreendida', 'Droga Apreendida'),
        ('Veículo Recuperado', 'Veículo Recuperado'),
        ('Outro', 'Outro'),
    )
    
    operacao = models.ForeignKey(OperacaoPolicial, on_delete=models.CASCADE, related_name='resultados')
    tipo = models.CharField(max_length=50, choices=TIPO_RESULTADO)
    descricao = models.TextField()
    quantidade = models.IntegerField(default=1)
    equipe = models.ForeignKey(EquipeOperacao, on_delete=models.SET_NULL, null=True, blank=True)
    
    registrado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    registrado_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-registrado_em']
        verbose_name = 'Resultado da Operação'
        verbose_name_plural = 'Resultados da Operação'

    def __str__(self):
        return f"{self.tipo}: {self.descricao[:50]}"


class AporteFinanceiro(models.Model):
    """Registro de aporte de custos de operações"""
    operacao = models.OneToOneField(OperacaoPolicial, on_delete=models.CASCADE, related_name='aporte')
    departamento_responsavel = models.ForeignKey(Departamento, on_delete=models.CASCADE)
    
    total_dpc = models.IntegerField(default=0, help_text="Total de DPCs na operação")
    total_oip = models.IntegerField(default=0, help_text="Total de OIPs na operação")
    total_efetivo = models.IntegerField(default=0, help_text="Total de efetivo")
    
    custo_total = models.DecimalField(max_digits=10, decimal_places=2)
    observacoes = models.TextField(blank=True, null=True)
    
    calculado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Aporte Financeiro'
        verbose_name_plural = 'Aportes Financeiros'

    def __str__(self):
        return f"Aporte: {self.operacao.nome} - R$ {self.custo_total}"


# =====================================================
# MODELOS PARA OPERAÇÕES DE EVENTO (CARNAVAL, ETC)
# =====================================================

class EventoOperacao(models.Model):
    """
    Operação especial para eventos (Carnaval, Réveillon, etc)
    """
    TIPOS_EVENTO = (
        ('CARNAVAL', 'Carnaval'),
        ('REVEILLON', 'Réveillon'),
        ('FESTA_PADROEIRO', 'Festa do Padroeiro'),
        ('SHOW', 'Show/Evento Musical'),
        ('ESPORTIVO', 'Evento Esportivo'),
        ('OUTRO', 'Outro'),
    )
    
    STATUS = (
        ('PLANEJAMENTO', 'Em Planejamento'),
        ('CADASTRO_INICIAL', 'Cadastro Inicial'),
        ('DEFININDO_ESCALAS', 'Definindo Escalas'),
        ('APROVADO', 'Aprovado'),
        ('EM_ANDAMENTO', 'Em Andamento'),
        ('CONCLUIDO', 'Concluído'),
        ('CANCELADO', 'Cancelado'),
    )

    nome = models.CharField(max_length=255)
    tipo_evento = models.CharField(max_length=30, choices=TIPOS_EVENTO)
    descricao = models.TextField(blank=True, null=True)
    local = models.CharField(max_length=255)
    data_inicio = models.DateField()
    data_fim = models.DateField()
    status = models.CharField(max_length=30, choices=STATUS, default='PLANEJAMENTO')
    
    # Campos de controle
    criado_por = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='eventos_criados')
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-data_inicio']
        verbose_name = 'Operação de Evento'
        verbose_name_plural = 'Operações de Evento'

    def __str__(self):
        return f"{self.nome} - {self.get_tipo_evento_display()}"


class DepartamentoEvento(models.Model):
    """
    Participação de um departamento em um evento
    Cadastro inicial: quantidade de policiais e configurações
    """
    TIPOS_SERVICO = (
        ('ORDINARIO', 'Serviço Ordinário'),
        ('EXTRAORDINARIO', 'Serviço Extraordinário'),
    )
    
    TIPOS_POLICIAL = (
        ('OIP', 'OIP - Oficiais de Plantão'),
        ('DPC', 'DPC - Delegado de Polícia Civil'),
    )

    evento = models.ForeignKey(EventoOperacao, on_delete=models.CASCADE, related_name='departamentos_participantes')
    departamento = models.ForeignKey(Departamento, on_delete=models.CASCADE, related_name='eventos_participacao')
    delegacia = models.ForeignKey(Delegacia, on_delete=models.SET_NULL, null=True, blank=True, related_name='eventos_participacao')
    
    # Cadastro Fase 1: Quantidades e configurações
    tipo_servico = models.CharField(max_length=20, choices=TIPOS_SERVICO)
    tipo_policial = models.CharField(max_length=10, choices=TIPOS_POLICIAL)
    quantidade_policiais = models.IntegerField(help_text="Quantidade total de policiais para este evento")
    com_aporte_financeiro = models.BooleanField(default=False, help_text="Se haverá aporte financeiro para esta operação")
    
    # Horário de funcionamento da delegacia/departamento
    horario_inicio_delegacia = models.TimeField()
    horario_fim_delegacia = models.TimeField()
    
    # Fase 2: Escalas individuais preenchidas?
    escalas_definidas = models.BooleanField(default=False)
    
    # Observações
    observacoes = models.TextField(blank=True, null=True)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['evento', 'departamento']
        verbose_name = 'Departamento no Evento'
        verbose_name_plural = 'Departamentos nos Eventos'
        unique_together = ('evento', 'departamento', 'delegacia')

    def __str__(self):
        return f"{self.departamento.nome} - {self.evento.nome}"


class EscalaPolicial(models.Model):
    """
    Escala individual de cada policial no evento
    Fase 2: Preenchimento dos horários de entrada e saída
    """
    departamento_evento = models.ForeignKey(DepartamentoEvento, on_delete=models.CASCADE, related_name='escalas')
    
    # Pode ser um policial cadastrado ou apenas identificação numérica
    policial = models.ForeignKey(Policial, on_delete=models.SET_NULL, null=True, blank=True, related_name='escalas_evento')
    identificacao = models.CharField(max_length=50, help_text="Ex: Policial 1, Policial 2, etc")
    
    # Horários de trabalho
    data_servico = models.DateField()
    horario_entrada = models.TimeField()
    horario_saida = models.TimeField()
    
    # Cálculos
    horas_trabalhadas = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    valor_hora = models.DecimalField(max_digits=10, decimal_places=2, default=0, help_text="Valor/hora para cálculo de custo")
    custo_total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Extras
    observacoes = models.TextField(blank=True, null=True)
    
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['departamento_evento', 'data_servico', 'horario_entrada']
        verbose_name = 'Escala de Policial'
        verbose_name_plural = 'Escalas de Policiais'

    def __str__(self):
        return f"{self.identificacao} - {self.data_servico} ({self.horario_entrada} às {self.horario_saida})"
    
    def calcular_horas(self):
        """Calcula as horas trabalhadas"""
        from datetime import datetime, timedelta
        
        entrada = datetime.combine(self.data_servico, self.horario_entrada)
        saida = datetime.combine(self.data_servico, self.horario_saida)
        
        # Se saída é menor que entrada, passou da meia-noite
        if saida < entrada:
            saida += timedelta(days=1)
        
        diferenca = saida - entrada
        horas = diferenca.total_seconds() / 3600
        
        self.horas_trabalhadas = round(horas, 2)
        self.custo_total = self.horas_trabalhadas * float(self.valor_hora)
        
        return self.horas_trabalhadas
    
    def save(self, *args, **kwargs):
        """Override save para calcular automaticamente"""
        self.calcular_horas()
        super().save(*args, **kwargs)


class Feriado(models.Model):
    """Feriados e datas especiais para controle de operações"""
    data = models.DateField(unique=True)
    nome = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, null=True)
    tipo = models.CharField(
        max_length=20,
        choices=[
            ('feriado_nacional', 'Feriado Nacional'),
            ('feriado_estadual', 'Feriado Estadual'),
            ('data_especial', 'Data Especial'),
            ('carnaval', 'Carnaval'),
            ('outro', 'Outro'),
        ],
        default='outro'
    )
    criado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['data']
        verbose_name_plural = 'Feriados'

    def __str__(self):
        return f"{self.nome} ({self.data.strftime('%d/%m/%Y')})"


class RelatorioComboio(models.Model):
    """Relatório enviado por um policial referente a um comboio/operação"""
    STATUS_CHOICES = (
        ('enviado', 'Enviado'),
        ('visualizado', 'Visualizado'),
    )

    titulo = models.CharField(max_length=255)
    descricao = models.TextField(blank=True, null=True)
    data_operacao = models.DateField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='enviado')

    policial = models.ForeignKey(Policial, on_delete=models.CASCADE, related_name='relatorios_comboio')
    departamento = models.ForeignKey(Departamento, on_delete=models.SET_NULL, null=True, blank=True, related_name='relatorios_comboio')
    delegacia = models.ForeignKey(Delegacia, on_delete=models.SET_NULL, null=True, blank=True, related_name='relatorios_comboio')
    comboio = models.ForeignKey(Comboio, on_delete=models.SET_NULL, null=True, blank=True, related_name='relatorios')
    operacao = models.ForeignKey(Operacao, on_delete=models.SET_NULL, null=True, blank=True, related_name='relatorios_comboio')

    visualizado_por = models.ManyToManyField(User, related_name='relatorios_comboio_visualizados', blank=True)

    enviado_em = models.DateTimeField(auto_now_add=True)
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-data_operacao', '-enviado_em']
        verbose_name = 'Relatório de Comboio'
        verbose_name_plural = 'Relatórios de Comboio'

    def __str__(self):
        return f"Relatório {self.titulo} - {self.policial.nome}"
