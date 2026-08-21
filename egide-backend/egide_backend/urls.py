from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from api.views import (
    DepartamentoViewSet, DelegaciaViewSet, PolicialViewSet,
    ViaturaViewSet, VagaViewSet, EquipeViewSet, OperacaoViewSet,
    ComboioViewSet, FeriadoViewSet,
    # Sistema de Operações
    OperacaoPolicialViewSet, AlvoViewSet, EquipeOperacaoViewSet,
    ResultadoOperacaoViewSet, AporteFinanceiroViewSet,
    # Sistema de Eventos
    EventoOperacaoViewSet, DepartamentoEventoViewSet, EscalaPolicialViewSet,
    FrequenciaPolicialViewSet,
    PagamentoViewSet,
    RelatorioComboioViewSet,
)
from api.views_auth import (
    login_view,
    logout_view,
    me_view,
    register_view,
    password_reset_view,
    password_reset_confirm_view,
)
from api.views_roster import roster_lookup_view

def api_root(request):
    """View raiz da API com informações sobre endpoints disponíveis"""
    return JsonResponse({
        'message': 'Sistema EGIDE + OPERAÇÕES - API REST',
        'version': '2.0.0',
        'endpoints': {
            'admin': '/admin/',
            'api': '/api/',
            'api_auth': '/api-auth/',
            'sistema_egide': {
                'departamentos': '/api/departamentos/',
                'delegacias': '/api/delegacias/',
                'policiais': '/api/policiais/',
                'roster_buscar': '/api/roster/buscar/?matricula=...',
                'viaturas': '/api/viaturas/',
                'vagas': '/api/vagas/',
                'equipes': '/api/equipes/',
                'operacoes': '/api/operacoes/',
                'comboios': '/api/comboios/',
            },
            'sistema_operacoes': {
                'operacoes_policiais': '/api/operacoes-policiais/',
                'alvos': '/api/alvos/',
                'equipes_operacao': '/api/equipes-operacao/',
                'resultados_operacao': '/api/resultados-operacao/',
                'aportes_financeiros': '/api/aportes-financeiros/',
            },
            'sistema_eventos': {
                'eventos': '/api/eventos/',
                'departamentos_evento': '/api/departamentos-evento/',
                'escalas': '/api/escalas/',
            }
        },
        'docs': 'Acesse /api/ para explorar os endpoints disponíveis'
    })


router = DefaultRouter()
router.register(r'departamentos', DepartamentoViewSet)
router.register(r'delegacias', DelegaciaViewSet)
router.register(r'policiais', PolicialViewSet)
router.register(r'viaturas', ViaturaViewSet)
router.register(r'vagas', VagaViewSet)
router.register(r'equipes', EquipeViewSet)
router.register(r'operacoes', OperacaoViewSet)
router.register(r'comboios', ComboioViewSet)
router.register(r'feriados', FeriadoViewSet)
router.register(r'pagamentos', PagamentoViewSet)

# Rotas do Sistema de Operações
router.register(r'operacoes-policiais', OperacaoPolicialViewSet, basename='operacaopolicial')
router.register(r'alvos', AlvoViewSet, basename='alvo')
router.register(r'equipes-operacao', EquipeOperacaoViewSet, basename='equipeoperacao')
router.register(r'resultados-operacao', ResultadoOperacaoViewSet, basename='resultadooperacao')
router.register(r'aportes-financeiros', AporteFinanceiroViewSet, basename='aportefinanceiro')

# Rotas do Sistema de Eventos
router.register(r'eventos', EventoOperacaoViewSet, basename='evento')
router.register(r'departamentos-evento', DepartamentoEventoViewSet, basename='departamentoevento')
router.register(r'escalas', EscalaPolicialViewSet, basename='escala')

# Frequência Operacional
router.register(r'frequencias', FrequenciaPolicialViewSet, basename='frequencia')

# Relatórios de Comboio
router.register(r'relatorios-comboio', RelatorioComboioViewSet, basename='relatoriocomboio')

urlpatterns = [
    path('', api_root, name='api-root'),  # View raiz
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api-auth/', include('rest_framework.urls')),
    # Autenticação JWT personalizada
    path('api/auth/register/', register_view, name='register'),
    path('api/auth/login/', login_view, name='login'),
    path('api/auth/logout/', logout_view, name='logout'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/me/', me_view, name='me'),
    path('api/auth/password-reset/', password_reset_view, name='password_reset'),
    path('api/auth/password-reset-confirm/', password_reset_confirm_view, name='password_reset_confirm'),
    # Autocompletar de matrícula (roster), usado em cadastro/escalas
    path('api/roster/buscar/', roster_lookup_view, name='roster_lookup'),
]
