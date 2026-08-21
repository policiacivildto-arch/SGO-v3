/**
 * Configuração da API Django
 * Dados armazenados em Database Django (SQLite ou PostgreSQL via Supabase)
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || process.env.REACT_APP_DJANGO_API_URL || 'http://127.0.0.1:8000/api';
const API_TIMEOUT = 30000; // 30 segundos
const CONVOY_REPORTS_STORAGE_KEY = 'egide_convoy_reports_local';

const PREFERRED_ERROR_KEYS = ['detail', 'error', 'message', 'msg'];

const pickArrayOrStringValue = (value) => {
  if (Array.isArray(value) && value.length > 0) {
    return String(value[0]);
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return null;
};

const buildHttpError = (status, error) => {
  const message = getApiErrorMessage(error, `Erro HTTP ${status}`);
  const requestError = new Error(message);
  requestError.status = status;
  return requestError;
};

const isPublicAuthEndpoint = (endpoint = '') => {
  const publicAuthPrefixes = [
    '/auth/login/',
    '/auth/refresh/',
    '/auth/register/',
    '/auth/password-reset/',
    '/auth/password-reset-confirm/',
    '/roster/buscar/',
  ];

  return publicAuthPrefixes.some((prefix) => endpoint.startsWith(prefix));
};

const shouldAttachAuthToken = ({ token, endpoint }) => {
  return Boolean(token && !isPublicAuthEndpoint(endpoint));
};

const shouldTryTokenRefresh = ({ status, options, isAuthLoginEndpoint, isAuthRefreshEndpoint, hasRefreshToken }) => {
  return Boolean(
    status === 401
    && !options._retry
    && !isAuthLoginEndpoint
    && !isAuthRefreshEndpoint
    && hasRefreshToken
  );
};

const parseJsonResponse = async (response) => {
  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return { success: true };
};

const getApiErrorMessage = (error, fallbackMessage) => {
  if (!error || typeof error !== 'object') {
    return fallbackMessage;
  }

  if (Array.isArray(error.non_field_errors) && error.non_field_errors.length > 0) {
    return error.non_field_errors[0] || fallbackMessage;
  }

  for (const key of PREFERRED_ERROR_KEYS) {
    const extracted = pickArrayOrStringValue(error[key]);
    if (extracted) {
      return extracted;
    }
  }

  const keys = Object.keys(error);
  if (!keys.length) {
    return fallbackMessage;
  }

  const firstKey = keys[0];
  const firstValue = error[firstKey];
  if (Array.isArray(firstValue)) {
    const firstArrayValue = firstValue[0];
    return firstArrayValue ? `${firstKey}: ${firstArrayValue}` : fallbackMessage;
  }

  if (firstValue !== null && firstValue !== undefined && String(firstValue).trim()) {
    return `${firstKey}: ${firstValue}`;
  }

  return fallbackMessage;
};

/**
 * Classe para gerenciar requisições à API Django
 */
class DjangoApiClient {
  constructor(baseURL = API_BASE_URL) {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('auth_token') || localStorage.getItem('access_token') || localStorage.getItem('django_token');
    if (this.token && !localStorage.getItem('auth_token')) {
      localStorage.setItem('auth_token', this.token);
    }
    // O backend atual não expõe /api/ranking/.
    // Pode ser reativado via env quando o endpoint existir.
    this.rankingEndpointAvailable = process.env.REACT_APP_ENABLE_RANKING_ENDPOINT === 'true';
    // O backend de produção pode não expor /api/convoy-reports/.
    // Mantemos fallback local para evitar spam de 404 no console.
    this.convoyReportsEndpointAvailable = process.env.REACT_APP_ENABLE_CONVOY_REPORTS_ENDPOINT === 'true';
  }

  /**
   * Define o token JWT para autenticação
   */
  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
      localStorage.setItem('access_token', token);
    } else {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('access_token');
      localStorage.removeItem('django_token');
    }
  }

  getRefreshToken() {
    return localStorage.getItem('refresh_token') || localStorage.getItem('django_refresh_token');
  }

  clearAuthStorage() {
    this.setToken(null);
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('django_refresh_token');
    localStorage.removeItem('django_user');
    localStorage.removeItem('user_data');
  }

  _shouldLogErrors(options = {}) {
    return !options?.suppressErrorLog;
  }

  async _handleRequestErrorResponse(response, error, requestContext) {
    const {
      method,
      endpoint,
      data,
      options,
      isAuthLoginEndpoint,
      isAuthRefreshEndpoint,
      hasRefreshToken,
    } = requestContext;

    if (this._shouldLogErrors(options)) {
      console.error(`Erro completo (${response.status}):`, error);
    }

    if (shouldTryTokenRefresh({
      status: response.status,
      options,
      isAuthLoginEndpoint,
      isAuthRefreshEndpoint,
      hasRefreshToken,
    })) {
      try {
        await this.refreshToken();
        return await this.request(method, endpoint, data, { ...options, _retry: true });
      } catch (refreshError) {
        console.error('Falha ao renovar token:', refreshError);
      }
    }

    if (response.status === 401) {
      this.clearAuthStorage();
    }

    throw buildHttpError(response.status, error);
  }

  /**
   * Faz uma requisição HTTP à API Django
   */
  async request(method, endpoint, data = null, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const isAuthLoginEndpoint = endpoint.startsWith('/auth/login/');
    const isAuthRefreshEndpoint = endpoint.startsWith('/auth/refresh/');
    const hasRefreshToken = Boolean(this.getRefreshToken());
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Adiciona token JWT se disponível
    if (shouldAttachAuthToken({ token: this.token, endpoint })) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const config = {
      method,
      headers,
      ...options,
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await Promise.race([
        fetch(url, config),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), API_TIMEOUT)
        ),
      ]);

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return await this._handleRequestErrorResponse(response, error, {
          method,
          endpoint,
          data,
          options,
          isAuthLoginEndpoint,
          isAuthRefreshEndpoint,
          hasRefreshToken,
        });
      }

      return await parseJsonResponse(response);
    } catch (error) {
      if (this._shouldLogErrors(options)) {
        console.error(`Erro na requisição ${method} ${endpoint}:`, error);
      }
      throw error;
    }
  }

  /**
   * Métodos de Autenticação
   */
  async login(email, password) {
    return this.request('POST', '/auth/login/', { username: email, password });
  }

  async register(userData) {
    return this.request('POST', '/auth/register/', userData);
  }

  async logout() {
    try {
      const refresh = this.getRefreshToken();
      await this.request('POST', '/auth/logout/', refresh ? { refresh } : null);
    } finally {
      this.clearAuthStorage();
    }
  }

  async refreshToken() {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) throw new Error('Nenhum refresh token disponível');
    try {
      const response = await this.request('POST', '/auth/refresh/', { refresh: refreshToken });
      if (response.access) {
        this.setToken(response.access);
        if (response.refresh) {
          localStorage.setItem('refresh_token', response.refresh);
          localStorage.setItem('django_refresh_token', response.refresh);
        }
        return response;
      }
      throw new Error('Token não retornado');
    } catch (error) {
      // Se refresh falhar, limpa os tokens
      this.clearAuthStorage();
      throw error;
    }
  }

  /**
   * Métodos de Usuário
   */
  async getCurrentUser() {
    return this.request('GET', '/auth/me/');
  }

  async updateUser(userData) {
    return this.request('PUT', '/auth/me/', userData);
  }

  async updatePhone(phoneNumber) {
    return this.request('PATCH', '/auth/me/', { phone_number: phoneNumber });
  }

  async changePassword(oldPassword, newPassword) {
    return this.request('POST', '/auth/change-password/', {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  async requestPasswordReset(matricula) {
    return this.request('POST', '/auth/password-reset/', { matricula });
  }

  async confirmPasswordReset(token, newPassword) {
    return this.request('POST', '/auth/password-reset-confirm/', {
      token,
      new_password: newPassword,
    });
  }

  /**
   * Métodos Genéricos para CRUD
   */
  async getList(resource, params = {}, options = {}) {
    const queryString = new URLSearchParams(params).toString();
    const endpoint = `/${resource}/${queryString ? '?' + queryString : ''}`;
    return this.request('GET', endpoint, null, options);
  }

  async getAllPages(resource, params = {}, options = {}) {
    const combinedResults = [];
    let page = 1;

    while (true) {
      const response = await this.getList(resource, { ...params, page }, options);

      if (Array.isArray(response)) {
        return page === 1 ? response : [...combinedResults, ...response];
      }

      const pageResults = Array.isArray(response?.results) ? response.results : [];
      combinedResults.push(...pageResults);

      if (!response?.next) {
        return combinedResults;
      }

      page += 1;
    }
  }

  async getDetail(resource, id, options = {}) {
    return this.request('GET', `/${resource}/${id}/`, null, options);
  }

  async create(resource, data, options = {}) {
    return this.request('POST', `/${resource}/`, data, options);
  }

  async update(resource, id, data, options = {}) {
    return this.request('PUT', `/${resource}/${id}/`, data, options);
  }

  async partialUpdate(resource, id, data, options = {}) {
    return this.request('PATCH', `/${resource}/${id}/`, data, options);
  }

  async delete(resource, id, options = {}) {
    return this.request('DELETE', `/${resource}/${id}/`, null, options);
  }

  /**
   * Métodos de Policiais (Usuários)
   */
  async getPoliciais(params = {}) {
    return this.getList('policiais', params);
  }

  async getAllPoliciais(params = {}) {
    return this.getAllPages('policiais', params);
  }

  async getPolicial(id) {
    return this.getDetail('policiais', id);
  }

  /**
   * Autocompletar de matrícula: consulta pública (sem exigir login) do
   * roster de matricula/nome/cargo. Retorna null quando não encontrada.
   */
  async buscarNoRoster(matricula) {
    const queryString = new URLSearchParams({ matricula }).toString();
    try {
      return await this.request('GET', `/roster/buscar/?${queryString}`);
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async createPolicial(data) {
    return this.create('policiais', data);
  }

  async updatePolicial(id, data) {
    return this.update('policiais', id, data);
  }

  async deletePolicial(id) {
    return this.delete('policiais', id);
  }

  /**
   * Métodos de Escalas (Schedules)
   */
  async getEscalas(weekId = null) {
    const params = weekId ? { week_id: weekId } : {};
    return this.getList('escalas', params);
  }

  async getEscala(id) {
    return this.getDetail('escalas', id);
  }

  async createEscala(data) {
    return this.create('escalas', data);
  }

  async updateEscala(id, data) {
    return this.update('escalas', id, data);
  }

  async deleteEscala(id) {
    return this.delete('escalas', id);
  }

  /**
   * Métodos de Operações
   */
  async getOperacoes(params = {}) {
    return this.getList('operacoes', params);
  }

  async getOperacao(id) {
    return this.getDetail('operacoes', id);
  }

  async createOperacao(data) {
    return this.create('operacoes', data);
  }

  async updateOperacao(id, data) {
    return this.update('operacoes', id, data);
  }

  async deleteOperacao(id) {
    return this.delete('operacoes', id);
  }

  /**
   * Métodos do Sistema de Operações Policiais
   */
  async getOperacoesPoliciais(params = {}) {
    return this.getList('operacoes-policiais', params);
  }

  async getMinhasOperacoesPoliciais() {
    return this.request('GET', '/operacoes-policiais/minhas_operacoes/');
  }

  async getEquipesOperacao(params = {}) {
    return this.getList('equipes-operacao', params);
  }

  async getResultadosOperacao(params = {}) {
    return this.getList('resultados-operacao', params);
  }

  async createResultadoOperacao(data) {
    return this.create('resultados-operacao', data);
  }

  /**
   * Métodos de Departamentos
   */
  async getDepartamentos(params = {}) {
    return this.getList('departamentos', params);
  }

  async getDepartamento(id) {
    return this.getDetail('departamentos', id);
  }

  /**
   * Métodos de Delegacias
   */
  async getDelegacias(params = {}) {
    return this.getList('delegacias', params);
  }

  async getDelegacia(id) {
    return this.getDetail('delegacias', id);
  }

  /**
   * Métodos de Eventos/Carnaval
   */
  async getEventos(params = {}) {
    return this.getList('eventos', params);
  }

  async getEvento(id) {
    return this.getDetail('eventos', id);
  }

  async createEvento(data) {
    return this.create('eventos', data);
  }

  async updateEvento(id, data) {
    return this.update('eventos', id, data);
  }

  async deleteEvento(id) {
    return this.delete('eventos', id);
  }

  /**
   * Métodos de Vagas
   */
  async getVagas(params = {}) {
    return this.getList('vagas', params);
  }

  async getAllVagas(params = {}) {
    return this.getAllPages('vagas', params);
  }

  async getVaga(id) {
    return this.getDetail('vagas', id);
  }

  async createVaga(data) {
    return this.create('vagas', data);
  }

  async updateVaga(id, data) {
    return this.partialUpdate('vagas', id, data);
  }

  async deleteVaga(id) {
    return this.delete('vagas', id);
  }

  /**
   * Métodos de Times/Equipes
   */
  async getTeams(params = {}) {
    return this.getList('equipes', params);
  }

  async getAllTeams(params = {}) {
    return this.getAllPages('equipes', params);
  }

  async getTeam(id) {
    return this.getDetail('equipes', id);
  }

  async createTeam(data) {
    return this.create('equipes', data);
  }

  async updateTeam(id, data) {
    return this.partialUpdate('equipes', id, data);
  }

  async deleteTeam(id) {
    return this.delete('equipes', id);
  }

  /**
   * Métodos de Comboios
   */
  async getConvoys(params = {}) {
    return this.getList('comboios', params);
  }

  async getAllConvoys(params = {}) {
    return this.getAllPages('comboios', params);
  }

  async getConvoy(id) {
    return this.getDetail('comboios', id);
  }

  async createConvoy(data) {
    return this.create('comboios', data);
  }

  async updateConvoy(id, data) {
    return this.update('comboios', id, data);
  }

  async deleteConvoy(id) {
    return this.delete('comboios', id);
  }

  /**
   * Métodos de Feriados
   */
  async getHolidays(params = {}) {
    return this.getList('feriados', params);
  }

  async getHoliday(id) {
    return this.getDetail('feriados', id);
  }

  async createHoliday(data) {
    return this.create('feriados', data);
  }

  async updateHoliday(id, data) {
    return this.update('feriados', id, data);
  }

  async deleteHoliday(id) {
    return this.delete('feriados', id);
  }

  /**
   * Métodos de Frequência Operacional
   */
  async getFrequencias(params = {}) {
    return this.getList('frequencias', params);
  }

  async getAllFrequencias(params = {}) {
    return this.getAllPages('frequencias', params);
  }

  async registrarFrequenciasLote(registros = []) {
    return this.create('frequencias/registrar_lote', { registros });
  }

  _isNotFoundError(error) {
    if (error?.status === 404) return true;
    const message = String(error?.message || '').toLowerCase();
    return message.includes('404') || message.includes('not found') || message.includes('não encontrado');
  }

  _getLocalConvoyReports() {
    try {
      const raw = localStorage.getItem(CONVOY_REPORTS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Não foi possível ler relatórios locais de comboio:', error);
      return [];
    }
  }

  _saveLocalConvoyReports(reports) {
    localStorage.setItem(CONVOY_REPORTS_STORAGE_KEY, JSON.stringify(reports));
  }

  _filterLocalConvoyReports(reports, params = {}) {
    let filtered = [...reports];

    const parseIsoDate = (raw) => {
      if (!raw) return null;
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return null;
      return parsed.toISOString().split('T')[0];
    };

    if (params.departamento) {
      filtered = filtered.filter((report) => String(report?.departamento || '') === String(params.departamento));
    }

    if (params.data_operacao__gte || params.data_operacao__lte || params.submitted_at__gte || params.submitted_at__lte) {
      const start = params.data_operacao__gte || params.submitted_at__gte || null;
      const end = params.data_operacao__lte || params.submitted_at__lte || null;

      filtered = filtered.filter((report) => {
        const rawDate = report?.data_operacao || report?.submittedAt || report?.submitted_at || report?.createdAt || report?.criado_em;
        const isoDate = parseIsoDate(rawDate);
        if (!isoDate) return false;
        if (start && isoDate < String(start)) return false;
        if (end && isoDate > String(end)) return false;
        return true;
      });
    }

    if (params.convoy_ids) {
      const ids = new Set(
        String(params.convoy_ids)
          .split(',')
          .map(Number)
          .filter((id) => !Number.isNaN(id))
      );
      filtered = filtered.filter((report) => ids.has(Number(report.convoyId)));
    }
    return filtered;
  }

  /**
   * Métodos de Relatórios de Comboio
   */
  async getConvoyReports(params = {}) {
    if (this.convoyReportsEndpointAvailable === false) {
      return this._filterLocalConvoyReports(this._getLocalConvoyReports(), params);
    }

    try {
      const data = await this.getList('convoy-reports', params, { suppressErrorLog: true });
      this.convoyReportsEndpointAvailable = true;
      return data;
    } catch (error) {
      if (error?.status === 404) {
        this.convoyReportsEndpointAvailable = false;
      }
      return this._filterLocalConvoyReports(this._getLocalConvoyReports(), params);
    }
  }

  async getConvoyReport(id) {
    if (this.convoyReportsEndpointAvailable === false) {
      const reports = this._getLocalConvoyReports();
      const report = reports.find((item) => String(item.id) === String(id));
      if (report) return report;
      throw new Error('Relatório não encontrado');
    }

    try {
      const data = await this.getDetail('convoy-reports', id, { suppressErrorLog: true });
      this.convoyReportsEndpointAvailable = true;
      return data;
    } catch (error) {
      if (error?.status === 404) {
        this.convoyReportsEndpointAvailable = false;
      }
      if (this._isNotFoundError(error)) {
        const reports = this._getLocalConvoyReports();
        const report = reports.find((item) => String(item.id) === String(id));
        if (report) return report;
        throw new Error('Relatório não encontrado');
      }
      throw error;
    }
  }

  async createConvoyReport(data) {
    if (this.convoyReportsEndpointAvailable === false) {
      const reports = this._getLocalConvoyReports();
      const newReport = {
        ...data,
        id: Date.now(),
        createdAt: new Date().toISOString(),
      };
      reports.push(newReport);
      this._saveLocalConvoyReports(reports);
      return newReport;
    }

    try {
      const created = await this.create('convoy-reports', data, { suppressErrorLog: true });
      this.convoyReportsEndpointAvailable = true;
      return created;
    } catch (error) {
      if (error?.status === 404) {
        this.convoyReportsEndpointAvailable = false;
      }
      if (this._isNotFoundError(error)) {
        const reports = this._getLocalConvoyReports();
        const newReport = {
          ...data,
          id: Date.now(),
          createdAt: new Date().toISOString(),
        };
        reports.push(newReport);
        this._saveLocalConvoyReports(reports);
        return newReport;
      }
      throw error;
    }
  }

  async updateConvoyReport(id, data) {
    if (this.convoyReportsEndpointAvailable === false) {
      const reports = this._getLocalConvoyReports();
      const index = reports.findIndex((item) => String(item.id) === String(id));
      if (index === -1) throw new Error('Relatório não encontrado');
      const updated = { ...reports[index], ...data, id: reports[index].id };
      reports[index] = updated;
      this._saveLocalConvoyReports(reports);
      return updated;
    }

    try {
      const updated = await this.update('convoy-reports', id, data, { suppressErrorLog: true });
      this.convoyReportsEndpointAvailable = true;
      return updated;
    } catch (error) {
      if (error?.status === 404) {
        this.convoyReportsEndpointAvailable = false;
      }
      if (this._isNotFoundError(error)) {
        const reports = this._getLocalConvoyReports();
        const index = reports.findIndex((item) => String(item.id) === String(id));
        if (index === -1) throw new Error('Relatório não encontrado');
        const updated = { ...reports[index], ...data, id: reports[index].id };
        reports[index] = updated;
        this._saveLocalConvoyReports(reports);
        return updated;
      }
      throw error;
    }
  }

  async deleteConvoyReport(id) {
    if (this.convoyReportsEndpointAvailable === false) {
      const reports = this._getLocalConvoyReports().filter((item) => String(item.id) !== String(id));
      this._saveLocalConvoyReports(reports);
      return { success: true };
    }

    try {
      const result = await this.delete('convoy-reports', id, { suppressErrorLog: true });
      this.convoyReportsEndpointAvailable = true;
      return result;
    } catch (error) {
      if (error?.status === 404) {
        this.convoyReportsEndpointAvailable = false;
      }
      if (this._isNotFoundError(error)) {
        const reports = this._getLocalConvoyReports().filter((item) => String(item.id) !== String(id));
        this._saveLocalConvoyReports(reports);
        return { success: true };
      }
      throw error;
    }
  }

  /**
   * Métodos de Rankings
   */
  async getRanking(params = {}) {
    if (this.rankingEndpointAvailable === false) {
      return [];
    }

    try {
      const data = await this.getList('ranking', params);
      this.rankingEndpointAvailable = true;
      return data;
    } catch (error) {
      if (error?.status === 404) {
        // O backend atual não expõe /api/ranking/.
        // Mantemos fallback local sem repetir erro a cada render.
        this.rankingEndpointAvailable = false;
        return [];
      }
      throw error;
    }
  }

  async getRankings(rankingType, filterType, dateRange, departamento) {
    const params = {
      ranking_type: rankingType,
      filter_type: filterType,
    };

    if (departamento) {
      params.departamento = departamento;
    }

    if (filterType === 'mes' && dateRange.month) {
      params.month = dateRange.month;
    } else if (filterType === 'periodo' && dateRange.startDate && dateRange.endDate) {
      params.start_date = dateRange.startDate;
      params.end_date = dateRange.endDate;
    }

    return this.getRanking(params);
  }
}

// Instância global da API
export const apiClient = new DjangoApiClient();

// Exportações
export { DjangoApiClient, API_BASE_URL, API_TIMEOUT };
