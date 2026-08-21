from datetime import timedelta

from django.db.models import Q
from rest_framework import serializers
from django.contrib.auth.models import User
from django.db import transaction
from .models import (
    Departamento, Delegacia, Policial, RosterPolicial, Viatura, Vaga,
    Equipe, Operacao, Comboio,
    OperacaoPolicial, Alvo, EquipeOperacao, SubstitutoOperacao,
    ResultadoOperacao, AporteFinanceiro,
    EventoOperacao, DepartamentoEvento, EscalaPolicial,
    Feriado, FrequenciaPolicial, Pagamento, RelatorioComboio
)
class PagamentoSerializer(serializers.ModelSerializer):
    policial_nome = serializers.CharField(source='policial.nome', read_only=True)

    class Meta:
        model = Pagamento
        fields = [
            'id', 'policial', 'policial_nome', 'data_operacao', 'horario_inicial',
            'horario_final', 'valor_pago', 'observacao', 'criado_em', 'atualizado_em'
        ]
        read_only_fields = ['criado_em', 'atualizado_em']
from .models_security import (
    PerfilPolicial, PerfilDepartamento, PerfilDelegacia,
    NotificacaoDepartamento, LogAuditoria, SessaoUsuario
)


class DepartamentoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Departamento
        fields = ['id', 'nome', 'sigla', 'descricao', 'ativo', 'criado_em', 'atualizado_em']
        read_only_fields = ['criado_em', 'atualizado_em']


class DelegaciaSerializer(serializers.ModelSerializer):
    departamento_nome = serializers.CharField(source='departamento.nome', read_only=True)

    class Meta:
        model = Delegacia
        fields = ['id', 'nome', 'departamento', 'departamento_nome', 'endereco', 'telefone', 'cidade', 'ativo', 'criado_em', 'atualizado_em']
        read_only_fields = ['criado_em', 'atualizado_em']


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name']
        read_only_fields = ['id']


class PolicialSerializer(serializers.ModelSerializer):
    usuario = UserSerializer(read_only=True)
    delegacia_nome = serializers.CharField(source='delegacia.nome', read_only=True)

    class Meta:
        model = Policial
        fields = ['id', 'usuario', 'matricula', 'nome', 'classe', 'cargo', 'delegacia', 'delegacia_nome', 'telefone', 'email', 'ativo', 'criado_em', 'atualizado_em']
        read_only_fields = ['criado_em', 'atualizado_em']


class RosterPolicialSerializer(serializers.ModelSerializer):
    class Meta:
        model = RosterPolicial
        fields = ['matricula', 'nome', 'cargo']


class ViaturaSerializer(serializers.ModelSerializer):
    delegacia_nome = serializers.CharField(source='delegacia.nome', read_only=True)

    class Meta:
        model = Viatura
        fields = ['id', 'placa', 'modelo', 'ano', 'delegacia', 'delegacia_nome', 'ativa', 'km_atual', 'criado_em', 'atualizado_em']
        read_only_fields = ['criado_em', 'atualizado_em']


class VagaSerializer(serializers.ModelSerializer):
    delegacia_nome = serializers.CharField(source='delegacia.nome', read_only=True)

    class Meta:
        model = Vaga
        fields = ['id', 'data', 'turno', 'delegacia', 'delegacia_nome', 'posicoes_disponiveis', 'descricao', 'status', 'restrito_adm_cadastra', 'criado_em', 'atualizado_em']
        read_only_fields = ['criado_em', 'atualizado_em']
        extra_kwargs = {
            'delegacia': {'required': False, 'allow_null': True},
        }

    def create(self, validated_data):
        # Hotfix de compatibilidade: se o frontend não enviar delegacia,
        # tenta usar primeiro uma delegacia com nome contendo DTO; caso não exista,
        # usa a primeira delegacia ativa disponível.
        if not validated_data.get('delegacia'):
            delegacia = Delegacia.objects.filter(ativo=True, nome__icontains='DTO').first()
            if not delegacia:
                delegacia = Delegacia.objects.filter(ativo=True).order_by('id').first()
            if not delegacia:
                raise serializers.ValidationError({'delegacia': 'Nenhuma delegacia ativa encontrada.'})
            validated_data['delegacia'] = delegacia

        return super().create(validated_data)


class EquipeSerializer(serializers.ModelSerializer):
    chefe_nome = serializers.CharField(source='chefe.nome', read_only=True)
    vaga_info = VagaSerializer(source='vaga', read_only=True)
    viatura_placa = serializers.CharField(source='viatura.placa', read_only=True)
    membros = serializers.PrimaryKeyRelatedField(queryset=Policial.objects.all(), many=True, required=False)
    membros_matriculas = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        write_only=True,
        allow_empty=False,
    )
    membros_nomes = serializers.DictField(
        child=serializers.CharField(),
        required=False,
        write_only=True,
    )
    chefe_matricula = serializers.CharField(required=False, write_only=True)
    membros_detalhes = PolicialSerializer(source='membros', many=True, read_only=True)
    membros_count = serializers.SerializerMethodField()

    class Meta:
        model = Equipe
        fields = ['id', 'vaga', 'vaga_info', 'chefe', 'chefe_nome', 'membros', 'membros_matriculas', 'membros_nomes', 'chefe_matricula', 'membros_detalhes', 'membros_count', 'viatura', 'viatura_placa', 'status', 'telefone_contato', 'observacoes', 'data_criacao', 'data_aprovacao', 'aprovado_por']
        read_only_fields = ['data_criacao', 'data_aprovacao']

    def get_membros_count(self, obj):
        return obj.membros.count()

    def _normalize_matricula(self, value):
        return ''.join(ch for ch in str(value or '') if ch.isdigit())

    def _is_pre_registered_user(self, user):
        if not user:
            return False
        return user.username.startswith('precad_') and user.email.endswith('@precad.egide.local')

    def _build_unique_placeholder_identity(self, matricula):
        base = f'precad_{matricula}'
        username = base
        index = 1
        while User.objects.filter(username=username).exists():
            username = f'{base}_{index}'
            index += 1

        email = f'{username}@precad.egide.local'
        return username, email

    def _resolve_or_create_policial(self, matricula, nome, delegacia):
        policial = Policial.objects.select_related('usuario').filter(matricula=matricula).first()
        if policial:
            if nome and self._is_pre_registered_user(policial.usuario) and policial.nome.startswith('Policial '):
                policial.nome = nome
                policial.save(update_fields=['nome'])
            return policial

        username, email = self._build_unique_placeholder_identity(matricula)
        user = User.objects.create(
            username=username,
            email=email,
            first_name=nome or f'Policial {matricula}',
            is_active=False,
        )
        user.set_unusable_password()
        user.save(update_fields=['password'])

        return Policial.objects.create(
            usuario=user,
            matricula=matricula,
            nome=nome or f'Policial {matricula}',
            classe='Praça',
            cargo='Policial Civil',
            delegacia=delegacia,
            telefone='',
            email=email,
            ativo=True,
        )

    def _resolve_membros_by_matricula(self, membros_matriculas, membros_nomes, delegacia):
        resolved = []
        for raw in membros_matriculas:
            matricula = self._normalize_matricula(raw)
            if len(matricula) != 8:
                raise serializers.ValidationError({
                    'membros_matriculas': f'Matrícula inválida: {raw}. Use 8 dígitos.'
                })
            nome = (membros_nomes.get(matricula) or membros_nomes.get(raw) or '').strip()
            resolved.append(self._resolve_or_create_policial(matricula, nome, delegacia))
        return resolved

    def _get_request_profile(self):
        request = self.context.get('request')
        user = getattr(request, 'user', None)

        if not user or not user.is_authenticated:
            return None

        try:
            return user.policial.perfil
        except Exception:
            return None

    def _user_is_admin(self):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False

        # Superuser/staff do Django sempre conta como admin.
        if user.is_staff or user.is_superuser:
            return True

        # Papel de admin definido pela própria aplicação (PerfilPolicial.tipo).
        perfil = self._get_request_profile()
        return bool(perfil and perfil.tipo == 'admin')

    def _user_can_bypass_single_delegacia_weekly_limit(self):
        return self._user_is_admin()


    def _department_requires_weekly_limit(self, departamento):
        if not departamento:
            return False

        if str(getattr(departamento, 'sigla', '')).upper() == 'DHPP':
            return True

        return departamento.delegacias.filter(ativo=True).count() == 1

    def _validate_day_shift_admin_only(self, vaga):
        if not vaga:
            return

        if str(getattr(vaga, 'turno', '')).lower() != 'day':
            return

        # Exceção de negócio: na terça há vaga aberta e vaga restrita.
        if getattr(vaga, 'data', None) and vaga.data.weekday() == 1:
            if not getattr(vaga, 'restrito_adm_cadastra', False):
                return

        if self._user_is_admin():
            return

        raise serializers.ValidationError(
            'Vagas diurnas de 12 horas só podem ser preenchidas por administrador.'
        )

    def _validate_tuesday_admin_only_slot(self, vaga):
        """Valida se a vaga é restrita para ADM em dias específicos (ex: terças)"""
        if not vaga:
            return

        # Verifica se a vaga está marcada como restrita para ADM
        if not getattr(vaga, 'restrito_adm_cadastra', False):
            return

        # Se o usuário é admin, permite
        if self._user_is_admin():
            return

        raise serializers.ValidationError(
            'Esta vaga está reservada exclusivamente para administrador. Apenas ADM pode cadastrar equipe nela.'
        )

    def _build_unique_candidates(self, membros, chefe=None):
        candidatos = []
        if chefe:
            candidatos.append(chefe)
        if membros:
            candidatos.extend(list(membros))

        vistos = set()
        unicos = []
        for policial in candidatos:
            if not policial or policial.id in vistos:
                continue
            vistos.add(policial.id)
            unicos.append(policial)
        return unicos

    def _validate_single_delegacia_weekly_limit(self, vaga, membros, chefe=None, instance=None):
        if self._user_can_bypass_single_delegacia_weekly_limit():
            return

        if not vaga or not vaga.data:
            return

        unicos = self._build_unique_candidates(membros, chefe=chefe)
        if not unicos:
            return

        week_start = vaga.data - timedelta(days=vaga.data.weekday())
        week_end = week_start + timedelta(days=6)

        for policial in unicos:
            delegacia = getattr(policial, 'delegacia', None)
            departamento = getattr(delegacia, 'departamento', None)

            if not self._department_requires_weekly_limit(departamento):
                continue

            equipes_semana = Equipe.objects.filter(
                vaga__data__gte=week_start,
                vaga__data__lte=week_end,
            ).filter(
                Q(chefe=policial) | Q(membros=policial)
            )

            if instance and instance.pk:
                equipes_semana = equipes_semana.exclude(pk=instance.pk)

            if equipes_semana.exists():
                raise serializers.ValidationError(
                    f'{policial.nome} só pode se candidatar uma vez por semana porque o departamento '
                    f'{departamento.sigla} possui apenas uma delegacia ativa. '
                    'Se necessário, um administrador pode escalá-lo manualmente.'
                )

    def _validate_daily_unique_allocation(self, vaga, membros, chefe=None, instance=None):
        if not vaga or not vaga.data:
            return

        candidatos = []
        if chefe:
            candidatos.append(chefe)
        if membros:
            candidatos.extend(list(membros))

        vistos = set()
        unicos = []
        for policial in candidatos:
            if not policial or policial.id in vistos:
                continue
            vistos.add(policial.id)
            unicos.append(policial)

        for policial in unicos:
            equipes_dia = Equipe.objects.filter(vaga__data=vaga.data).filter(
                Q(chefe=policial) | Q(membros=policial)
            )

            if instance and instance.pk:
                equipes_dia = equipes_dia.exclude(pk=instance.pk)

            if equipes_dia.exists():
                raise serializers.ValidationError(
                    f'{policial.nome} já está escalado(a) em outra equipe no dia {vaga.data}. '
                    'Não é permitido se candidatar duas vezes no mesmo dia.'
                )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        membros_ids = attrs.get('membros')
        membros_matriculas = attrs.get('membros_matriculas')
        if not membros_ids and not membros_matriculas:
            raise serializers.ValidationError({
                'membros': 'Informe membros por ID ou membros_matriculas para criar a equipe.'
            })
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        membros = validated_data.pop('membros', None)
        membros_matriculas = validated_data.pop('membros_matriculas', None)
        membros_nomes = validated_data.pop('membros_nomes', {}) or {}
        chefe_matricula = self._normalize_matricula(validated_data.pop('chefe_matricula', ''))
        vaga = validated_data.get('vaga')

        self._validate_day_shift_admin_only(vaga)
        self._validate_tuesday_admin_only_slot(vaga)

        if membros_matriculas:
            delegacia = vaga.delegacia if vaga else None
            membros = self._resolve_membros_by_matricula(membros_matriculas, membros_nomes, delegacia)

        if not validated_data.get('chefe'):
            if chefe_matricula:
                validated_data['chefe'] = next((m for m in membros or [] if m.matricula == chefe_matricula), None)
            if not validated_data.get('chefe') and membros:
                validated_data['chefe'] = membros[0]

        self._validate_daily_unique_allocation(
            vaga,
            membros,
            chefe=validated_data.get('chefe'),
        )
        self._validate_single_delegacia_weekly_limit(
            vaga,
            membros,
            chefe=validated_data.get('chefe'),
        )

        instance = super().create(validated_data)
        if membros is not None:
            instance.membros.set(membros)
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        membros = validated_data.pop('membros', None)
        membros_matriculas = validated_data.pop('membros_matriculas', None)
        membros_nomes = validated_data.pop('membros_nomes', {}) or {}
        chefe_matricula = self._normalize_matricula(validated_data.pop('chefe_matricula', ''))

        if membros_matriculas:
            vaga = validated_data.get('vaga', instance.vaga)
            delegacia = vaga.delegacia if vaga else None
            membros = self._resolve_membros_by_matricula(membros_matriculas, membros_nomes, delegacia)

        vaga = validated_data.get('vaga', instance.vaga)
        self._validate_day_shift_admin_only(vaga)
        self._validate_tuesday_admin_only_slot(vaga)
        membros_efetivos = membros if membros is not None else list(instance.membros.all())

        if not validated_data.get('chefe') and chefe_matricula and membros:
            validated_data['chefe'] = next((m for m in membros if m.matricula == chefe_matricula), None)

        chefe_efetivo = validated_data.get('chefe', instance.chefe)
        self._validate_daily_unique_allocation(vaga, membros_efetivos, chefe=chefe_efetivo, instance=instance)
        self._validate_single_delegacia_weekly_limit(
            vaga,
            membros_efetivos,
            chefe=chefe_efetivo,
            instance=instance,
        )

        updated = super().update(instance, validated_data)
        if membros is not None:
            updated.membros.set(membros)
            if not updated.chefe and membros:
                updated.chefe = membros[0]
                updated.save(update_fields=['chefe'])
        return updated


class OperacaoSerializer(serializers.ModelSerializer):
    equipe_info = serializers.SerializerMethodField()

    class Meta:
        model = Operacao
        fields = ['id', 'data_inicio', 'data_fim', 'equipe', 'equipe_info', 'descricao', 'status', 'ais', 'bairros', 'resultado', 'criado_em']
        read_only_fields = ['criado_em']

    def get_equipe_info(self, obj):
        if obj.equipe:
            return {'id': obj.equipe.id, 'chefe': obj.equipe.chefe.nome}
        return None


class ComboioSerializer(serializers.ModelSerializer):
    dpc_nome = serializers.CharField(source='dpc.nome', read_only=True)
    oip_nome = serializers.CharField(source='oip.nome', read_only=True)
    operacoes_count = serializers.SerializerMethodField()
    team_ids = serializers.SerializerMethodField()

    class Meta:
        model = Comboio
        fields = ['id', 'data', 'descricao', 'dpc', 'dpc_nome', 'oip', 'oip_nome', 'status', 'ais', 'bairros', 'operacoes_count', 'team_ids', 'criado_em', 'atualizado_em']
        read_only_fields = ['criado_em', 'atualizado_em']

    def get_operacoes_count(self, obj):
        return obj.operacoes.count()

    def get_team_ids(self, obj):
        """Retorna os IDs das equipes vinculadas via operações do comboio"""
        return list(
            obj.operacoes.filter(equipe__isnull=False)
               .values_list('equipe__id', flat=True)
               .distinct()
        )


# ===================================
# SERIALIZERS - SISTEMA DE OPERAÇÕES
# ===================================

class AlvoSerializer(serializers.ModelSerializer):
    dossie_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Alvo
        fields = ['id', 'operacao', 'nome', 'tipo', 'descricao', 'endereco', 
                  'dossie_pdf', 'dossie_url', 'visivel_apos_briefing', 
                  'criado_em', 'atualizado_em']
        read_only_fields = ['criado_em', 'atualizado_em']
    
    def get_dossie_url(self, obj):
        if obj.dossie_pdf:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.dossie_pdf.url)
        return None


class SubstitutoOperacaoSerializer(serializers.ModelSerializer):
    policial_planejado_nome = serializers.CharField(source='policial_planejado.nome', read_only=True)
    policial_substituto_nome = serializers.CharField(source='policial_substituto.nome', read_only=True)
    
    class Meta:
        model = SubstitutoOperacao
        fields = ['id', 'equipe', 'policial_planejado', 'policial_planejado_nome',
                  'policial_substituto', 'policial_substituto_nome', 
                  'motivo', 'registrado_em']
        read_only_fields = ['registrado_em']


class EquipeOperacaoSerializer(serializers.ModelSerializer):
    departamento_nome = serializers.CharField(source='departamento.nome', read_only=True)
    delegacia_nome = serializers.CharField(source='delegacia.nome', read_only=True)
    chefe_nome = serializers.CharField(source='chefe.nome', read_only=True)
    viatura_placa = serializers.CharField(source='viatura.placa', read_only=True)
    membros_detalhes = PolicialSerializer(source='membros', many=True, read_only=True)
    substitutos = SubstitutoOperacaoSerializer(many=True, read_only=True)
    membros_count = serializers.SerializerMethodField()
    
    class Meta:
        model = EquipeOperacao
        fields = ['id', 'operacao', 'departamento', 'departamento_nome', 
                  'delegacia', 'delegacia_nome', 'chefe', 'chefe_nome', 
                  'membros', 'membros_detalhes', 'membros_count',
                  'viatura', 'viatura_placa', 'confirmou_presenca', 
                  'hora_retorno', 'substitutos', 'observacoes', 'criado_em']
        read_only_fields = ['criado_em']
    
    def get_membros_count(self, obj):
        return obj.membros.count()


class ResultadoOperacaoSerializer(serializers.ModelSerializer):
    equipe_info = serializers.SerializerMethodField()
    registrado_por_nome = serializers.CharField(source='registrado_por.username', read_only=True)
    
    class Meta:
        model = ResultadoOperacao
        fields = ['id', 'operacao', 'tipo', 'descricao', 'quantidade', 
                  'equipe', 'equipe_info', 'registrado_por', 'registrado_por_nome',
                  'registrado_em']
        read_only_fields = ['registrado_por', 'registrado_em']
    
    def get_equipe_info(self, obj):
        if obj.equipe:
            return {
                'id': obj.equipe.id,
                'departamento': obj.equipe.departamento.sigla,
                'chefe': obj.equipe.chefe.nome if obj.equipe.chefe else None
            }
        return None


class AporteFinanceiroSerializer(serializers.ModelSerializer):
    departamento_nome = serializers.CharField(source='departamento_responsavel.nome', read_only=True)
    operacao_nome = serializers.CharField(source='operacao.nome', read_only=True)
    
    class Meta:
        model = AporteFinanceiro
        fields = ['id', 'operacao', 'operacao_nome', 'departamento_responsavel', 
                  'departamento_nome', 'total_dpc', 'total_oip', 'total_efetivo',
                  'custo_total', 'observacoes', 'calculado_em', 'atualizado_em']
        read_only_fields = ['calculado_em', 'atualizado_em']


class OperacaoPolicialSerializer(serializers.ModelSerializer):
    departamento_solicitante_nome = serializers.CharField(source='departamento_solicitante.nome', read_only=True)
    delegacia_solicitante_nome = serializers.CharField(source='delegacia_solicitante.nome', read_only=True)
    responsavel_operacao_nome = serializers.CharField(source='responsavel_operacao.nome', read_only=True)
    aprovado_por_nome = serializers.CharField(source='aprovado_por.username', read_only=True)
    criado_por_nome = serializers.CharField(source='criado_por.username', read_only=True)
    responsavel_custo_nome = serializers.CharField(source='responsavel_custo.nome', read_only=True)
    
    departamentos_apoio_detalhes = DepartamentoSerializer(source='departamentos_apoio', many=True, read_only=True)
    alvos = AlvoSerializer(many=True, read_only=True)
    equipes_operacao = EquipeOperacaoSerializer(many=True, read_only=True)
    resultados = ResultadoOperacaoSerializer(many=True, read_only=True)
    aporte = AporteFinanceiroSerializer(read_only=True)
    
    total_equipes = serializers.SerializerMethodField()
    total_alvos = serializers.SerializerMethodField()
    total_resultados = serializers.SerializerMethodField()
    
    class Meta:
        model = OperacaoPolicial
        fields = [
            'id', 'nome', 'departamento_solicitante', 'departamento_solicitante_nome',
            'delegacia_solicitante', 'delegacia_solicitante_nome',
            'tipo_operacao', 'objetivo', 'data_hora_inicio', 'data_hora_fim', 
            'data_hora_briefing', 'local_concentracao', 'responsavel_operacao', 
            'responsavel_operacao_nome', 'departamentos_apoio', 'departamentos_apoio_detalhes',
            'status', 'aprovado_por', 'aprovado_por_nome', 'data_aprovacao', 
            'motivo_reprovacao', 'custo_planejado', 'custo_real', 
            'responsavel_custo', 'responsavel_custo_nome', 'criado_por', 
            'criado_por_nome', 'criado_em', 'atualizado_em', 'plano_operacional',
            'alvos', 'equipes_operacao', 'resultados', 'aporte',
            'total_equipes', 'total_alvos', 'total_resultados'
        ]
        read_only_fields = ['criado_por', 'criado_em', 'atualizado_em', 
                            'aprovado_por', 'data_aprovacao', 'responsavel_custo']

    def validate(self, attrs):
        attrs = super().validate(attrs)
        delegacia_solicitante = attrs.get('delegacia_solicitante')
        departamento_solicitante = attrs.get('departamento_solicitante')

        if delegacia_solicitante and departamento_solicitante and delegacia_solicitante.departamento_id != departamento_solicitante.id:
            raise serializers.ValidationError({
                'delegacia_solicitante': 'A delegacia informada não pertence ao departamento solicitante.'
            })

        return attrs
    
    def get_total_equipes(self, obj):
        return obj.equipes_operacao.count()
    
    def get_total_alvos(self, obj):
        return obj.alvos.count()
    
    def get_total_resultados(self, obj):
        return obj.resultados.count()


class OperacaoPolicialListSerializer(serializers.ModelSerializer):
    """Serializer simplificado para listagem"""
    departamento_solicitante_sigla = serializers.CharField(source='departamento_solicitante.sigla', read_only=True)
    delegacia_solicitante_nome = serializers.CharField(source='delegacia_solicitante.nome', read_only=True)
    responsavel_nome = serializers.CharField(source='responsavel_operacao.nome', read_only=True)
    total_equipes = serializers.SerializerMethodField()
    
    class Meta:
        model = OperacaoPolicial
        fields = ['id', 'nome', 'departamento_solicitante_sigla', 'delegacia_solicitante_nome', 'tipo_operacao',
                  'status', 'data_hora_inicio', 'data_hora_briefing', 'plano_operacional',
                  'responsavel_nome', 'total_equipes', 'criado_em']
        read_only_fields = ['criado_em']
    
    def get_total_equipes(self, obj):
        return obj.equipes_operacao.count()


# =====================================================
# SERIALIZERS PARA OPERAÇÕES DE EVENTO
# =====================================================

class EscalaPolicialSerializer(serializers.ModelSerializer):
    """Serializer para escalas individuais de policiais"""
    policial_nome = serializers.CharField(source='policial.nome', read_only=True)
    
    class Meta:
        model = EscalaPolicial
        fields = [
            'id', 'departamento_evento', 'policial', 'policial_nome', 'identificacao',
            'data_servico', 'horario_entrada', 'horario_saida', 
            'horas_trabalhadas', 'valor_hora', 'custo_total',
            'observacoes', 'criado_em', 'atualizado_em'
        ]
        read_only_fields = ['horas_trabalhadas', 'custo_total', 'criado_em', 'atualizado_em']


class DepartamentoEventoSerializer(serializers.ModelSerializer):
    """Serializer para participação de departamento em evento"""
    departamento_nome = serializers.CharField(source='departamento.nome', read_only=True)
    delegacia_nome = serializers.CharField(source='delegacia.nome', read_only=True)
    escalas = EscalaPolicialSerializer(many=True, read_only=True)
    total_escalas = serializers.SerializerMethodField()
    custo_total_departamento = serializers.SerializerMethodField()
    total_horas = serializers.SerializerMethodField()
    
    class Meta:
        model = DepartamentoEvento
        fields = [
            'id', 'evento', 'departamento', 'departamento_nome', 
            'delegacia', 'delegacia_nome', 'tipo_servico', 'tipo_policial',
            'quantidade_policiais', 'com_aporte_financeiro',
            'horario_inicio_delegacia', 'horario_fim_delegacia',
            'escalas_definidas', 'observacoes',
            'escalas', 'total_escalas', 'custo_total_departamento', 'total_horas',
            'criado_em', 'atualizado_em'
        ]
        read_only_fields = ['escalas_definidas', 'criado_em', 'atualizado_em']
    
    def get_total_escalas(self, obj):
        return obj.escalas.count()
    
    def get_custo_total_departamento(self, obj):
        from django.db.models import Sum
        total = obj.escalas.aggregate(Sum('custo_total'))['custo_total__sum']
        return float(total) if total else 0
    
    def get_total_horas(self, obj):
        from django.db.models import Sum
        total = obj.escalas.aggregate(Sum('horas_trabalhadas'))['horas_trabalhadas__sum']
        return float(total) if total else 0


class DepartamentoEventoSimplificadoSerializer(serializers.ModelSerializer):
    """Versão simplificada sem escalas para listagens"""
    departamento_nome = serializers.CharField(source='departamento.nome', read_only=True)
    delegacia_nome = serializers.CharField(source='delegacia.nome', read_only=True)
    total_escalas = serializers.SerializerMethodField()
    
    class Meta:
        model = DepartamentoEvento
        fields = [
            'id', 'departamento', 'departamento_nome', 
            'delegacia', 'delegacia_nome', 'tipo_servico', 'tipo_policial',
            'quantidade_policiais', 'com_aporte_financeiro',
            'escalas_definidas', 'total_escalas'
        ]
    
    def get_total_escalas(self, obj):
        return obj.escalas.count()


class EventoOperacaoSerializer(serializers.ModelSerializer):
    """Serializer completo para eventos"""
    criado_por_nome = serializers.CharField(source='criado_por.username', read_only=True)
    departamentos_participantes = DepartamentoEventoSimplificadoSerializer(many=True, read_only=True)
    total_departamentos = serializers.SerializerMethodField()
    total_policiais_planejado = serializers.SerializerMethodField()
    total_escalas = serializers.SerializerMethodField()
    custo_total_evento = serializers.SerializerMethodField()
    
    class Meta:
        model = EventoOperacao
        fields = [
            'id', 'nome', 'tipo_evento', 'descricao', 'local',
            'data_inicio', 'data_fim', 'status',
            'criado_por', 'criado_por_nome',
            'departamentos_participantes', 'total_departamentos',
            'total_policiais_planejado', 'total_escalas', 'custo_total_evento',
            'criado_em', 'atualizado_em'
        ]
        read_only_fields = ['criado_por', 'criado_em', 'atualizado_em']
    
    def get_total_departamentos(self, obj):
        return obj.departamentos_participantes.count()
    
    def get_total_policiais_planejado(self, obj):
        from django.db.models import Sum
        total = obj.departamentos_participantes.aggregate(Sum('quantidade_policiais'))['quantidade_policiais__sum']
        return total if total else 0
    
    def get_total_escalas(self, obj):
        total = 0
        for dep in obj.departamentos_participantes.all():
            total += dep.escalas.count()
        return total
    
    def get_custo_total_evento(self, obj):
        from django.db.models import Sum
        total = 0
        for dep in obj.departamentos_participantes.all():
            custo_dep = dep.escalas.aggregate(Sum('custo_total'))['custo_total__sum']
            if custo_dep:
                total += float(custo_dep)
        return total


class EventoOperacaoListSerializer(serializers.ModelSerializer):
    """Versão simplificada para listagens"""
    criado_por_nome = serializers.CharField(source='criado_por.username', read_only=True)
    total_departamentos = serializers.SerializerMethodField()
    total_policiais_planejado = serializers.SerializerMethodField()
    
    class Meta:
        model = EventoOperacao
        fields = [
            'id', 'nome', 'tipo_evento', 'local',
            'data_inicio', 'data_fim', 'status',
            'criado_por_nome', 'total_departamentos', 'total_policiais_planejado',
            'criado_em'
        ]
    
    def get_total_departamentos(self, obj):
        return obj.departamentos_participantes.count()
    
    def get_total_policiais_planejado(self, obj):
        from django.db.models import Sum
        total = obj.departamentos_participantes.aggregate(Sum('quantidade_policiais'))['quantidade_policiais__sum']
        return total if total else 0


class FeriadoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Feriado
        fields = ['id', 'data', 'nome', 'descricao', 'tipo', 'criado_em', 'atualizado_em']
        read_only_fields = ['criado_em', 'atualizado_em']


class FrequenciaPolicialSerializer(serializers.ModelSerializer):
    policial_nome = serializers.CharField(source='policial.nome', read_only=True)
    policial_matricula = serializers.CharField(source='policial.matricula', read_only=True)
    substituto_nome = serializers.CharField(source='substituto.nome', read_only=True, allow_null=True)
    substituto_matricula = serializers.CharField(source='substituto.matricula', read_only=True, allow_null=True)

    class Meta:
        model = FrequenciaPolicial
        fields = [
            'id', 'equipe', 'policial', 'policial_nome', 'policial_matricula',
            'data_operacao', 'status', 'substituto', 'substituto_nome',
            'substituto_matricula', 'registrado_por', 'criado_em', 'atualizado_em'
        ]
        read_only_fields = ['criado_em', 'atualizado_em']


class RelatorioComboioSerializer(serializers.ModelSerializer):
    policial_nome = serializers.CharField(source='policial.nome', read_only=True)
    departamento_nome = serializers.CharField(source='departamento.nome', read_only=True, allow_null=True)
    delegacia_nome = serializers.CharField(source='delegacia.nome', read_only=True, allow_null=True)
    visualizado_por_count = serializers.IntegerField(source='visualizado_por.count', read_only=True)

    class Meta:
        model = RelatorioComboio
        fields = [
            'id', 'titulo', 'descricao', 'data_operacao', 'status',
            'policial', 'policial_nome', 'departamento', 'departamento_nome',
            'delegacia', 'delegacia_nome', 'comboio', 'operacao',
            'visualizado_por', 'visualizado_por_count',
            'enviado_em', 'atualizado_em',
        ]
        read_only_fields = ['policial', 'departamento', 'delegacia', 'visualizado_por', 'enviado_em', 'atualizado_em']

