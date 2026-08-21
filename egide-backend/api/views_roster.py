"""
View pública e somente-leitura do roster de matrícula/nome/cargo.

Substitui o antigo `src/data/policiais.json`, que era embutido no bundle
do frontend (expondo o cadastro completo do efetivo a qualquer visitante,
mesmo sem login). Aqui a consulta é sempre por matrícula exata — nunca há
listagem em massa, então o cadastro completo nunca trafega de uma vez.
"""
import re

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from api.models import RosterPolicial
from api.serializers import RosterPolicialSerializer

MATRICULA_CHARS = re.compile(r'[^0-9X]')


def _normalize_matricula(value):
    raw = str(value or '').strip().upper()
    return MATRICULA_CHARS.sub('', raw)


@api_view(['GET'])
@permission_classes([AllowAny])
def roster_lookup_view(request):
    """
    GET /api/roster/buscar/?matricula=12345678

    Retorna {matricula, nome, cargo} para a matrícula exata informada,
    ou 404 se não encontrada. Não aceita busca parcial nem listagem.
    """
    matricula = _normalize_matricula(request.query_params.get('matricula'))
    if not matricula:
        return Response(
            {'error': 'Informe o parâmetro "matricula".'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    roster = RosterPolicial.objects.filter(matricula=matricula).first()
    if not roster:
        return Response(status=status.HTTP_404_NOT_FOUND)

    return Response(RosterPolicialSerializer(roster).data)
