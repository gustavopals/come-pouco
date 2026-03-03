const crypto = require('crypto');

const BASE_URL = (process.env.POST_DEPLOY_SMOKE_BASE_URL || 'http://localhost:3000/api').replace(/\/+$/, '');
const REQUEST_TIMEOUT_MS = Math.max(1000, Number(process.env.POST_DEPLOY_SMOKE_TIMEOUT_MS || 15000) || 15000);
const ADMIN_IDENTIFIER = process.env.POST_DEPLOY_SMOKE_ADMIN_IDENTIFIER || 'admin';
const ADMIN_PASSWORD = process.env.POST_DEPLOY_SMOKE_ADMIN_PASSWORD || 'comepouco102030@';
const ADMIN_2FA_CODE = process.env.POST_DEPLOY_SMOKE_ADMIN_2FA_CODE;
const SMOKE_COMPANY_NAME = process.env.POST_DEPLOY_SMOKE_COMPANY_NAME || 'Smoke Test Company';
const OWNER_PASSWORD = process.env.POST_DEPLOY_SMOKE_OWNER_PASSWORD || 'SmokeOwner123!';
const EMPLOYEE_PASSWORD = process.env.POST_DEPLOY_SMOKE_EMPLOYEE_PASSWORD || 'SmokeEmployee123!';
const KEEP_DATA = String(process.env.POST_DEPLOY_SMOKE_KEEP_DATA || 'false').toLowerCase() === 'true';

const checks = [];

const created = {
  platformId: null,
  companyId: null,
  ownerId: null,
  employeeId: null,
  ownerUsername: null
};

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

const normalizeBase32 = (value) => value.toUpperCase().replace(/=+$/g, '').replace(/\s+/g, '');

const base32ToBuffer = (base32) => {
  const normalized = normalizeBase32(base32);
  let bits = '';

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);

    if (index < 0) {
      throw new Error('Segredo TOTP invalido (base32).');
    }

    bits += index.toString(2).padStart(5, '0');
  }

  const bytes = [];
  for (let cursor = 0; cursor + 8 <= bits.length; cursor += 8) {
    bytes.push(parseInt(bits.slice(cursor, cursor + 8), 2));
  }

  return Buffer.from(bytes);
};

const generateTotp = (secret, now = Date.now(), step = 30, digits = 6) => {
  const counter = Math.floor(Math.floor(now / 1000) / step);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  counterBuffer.writeUInt32BE(counter % 0x100000000, 4);

  const key = base32ToBuffer(secret);
  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return (binaryCode % 10 ** digits).toString().padStart(digits, '0');
};

const generateTotpCandidates = (secret, now = Date.now()) => {
  const codes = [generateTotp(secret, now), generateTotp(secret, now - 30000), generateTotp(secret, now + 30000)];
  return [...new Set(codes)];
};

const getErrorMessage = (error) => {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause = error.cause;

  if (!cause) {
    return error.message;
  }

  if (cause instanceof Error) {
    return `${error.message} (${cause.message})`;
  }

  return `${error.message} (${String(cause)})`;
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const runCheck = async (name, callback) => {
  try {
    await callback();
    checks.push({ name, ok: true });
    console.log(`OK ${name}`);
  } catch (error) {
    const message = getErrorMessage(error);
    checks.push({ name, ok: false, message });
    console.error(`FAIL ${name}: ${message}`);
    throw error;
  }
};

const apiRequest = async ({ method, path, token, body }) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    let response;
    try {
      response = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
    } catch (error) {
      if (error && typeof error === 'object' && error.name === 'AbortError') {
        throw new Error(`Timeout em ${method} ${path} apos ${REQUEST_TIMEOUT_MS}ms.`);
      }

      throw new Error(`Falha de rede em ${method} ${path}: ${getErrorMessage(error)}`);
    }

    const text = await response.text();
    let data = {};

    if (text.trim().length) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }

    return { status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
};

const parseSecretFromOtpAuth = (otpauthUrl) => {
  try {
    const parsed = new URL(otpauthUrl);
    const secret = parsed.searchParams.get('secret') || '';
    assert(secret.trim().length > 0, 'Resposta de setup 2FA sem secret.');
    return secret.trim();
  } catch {
    throw new Error('otpauthUrl invalido retornado pelo setup 2FA.');
  }
};

const requestWithTotpRetries = async ({ token, path, tempToken, secret, contextLabel }) => {
  const codes = generateTotpCandidates(secret);
  let lastStatus = null;

  for (const code of codes) {
    const response = await apiRequest({
      method: 'POST',
      path,
      token,
      body: tempToken
        ? {
            tempToken,
            code
          }
        : { code }
    });

    if (response.status === 200) {
      return response;
    }

    lastStatus = response.status;
  }

  throw new Error(`${contextLabel}. status=${lastStatus ?? 'sem resposta'}`);
};

const login = async ({ identifier, password, twoFactorCode }) => {
  const loginResponse = await apiRequest({
    method: 'POST',
    path: '/auth/login',
    body: { identifier, password }
  });

  assert(loginResponse.status === 200, `Falha no login (${identifier}). status=${loginResponse.status}`);

  if (loginResponse.data && loginResponse.data.token) {
    return {
      token: loginResponse.data.token,
      user: loginResponse.data.user,
      challenge: null
    };
  }

  const challenge = loginResponse.data?.tempToken || loginResponse.data?.challengeId;
  assert(challenge, `Login de ${identifier} retornou payload inesperado.`);

  const code = typeof twoFactorCode === 'function' ? await twoFactorCode() : twoFactorCode;
  assert(code && String(code).trim().length > 0, `Login de ${identifier} exige 2FA. Informe POST_DEPLOY_SMOKE_ADMIN_2FA_CODE.`);

  const verifyResponse = await apiRequest({
    method: 'POST',
    path: '/auth/login/2fa',
    body: {
      tempToken: challenge,
      code: String(code).trim()
    }
  });

  assert(verifyResponse.status === 200, `Falha na validacao 2FA (${identifier}). status=${verifyResponse.status}`);
  assert(verifyResponse.data?.token, `Resposta de 2FA sem token (${identifier}).`);

  return {
    token: verifyResponse.data.token,
    user: verifyResponse.data.user,
    challenge
  };
};

const ensureMockPlatform = async (adminToken) => {
  const listResponse = await apiRequest({
    method: 'GET',
    path: '/purchase-platforms',
    token: adminToken
  });

  assert(listResponse.status === 200, `Falha ao listar plataformas. status=${listResponse.status}`);
  const platforms = Array.isArray(listResponse.data?.platforms) ? listResponse.data.platforms : [];

  const existing = platforms.find((platform) => platform.type === 'SHOPEE' && platform.isActive && platform.mockMode);
  if (existing) {
    return existing;
  }

  const platformName = `Smoke Mock ${Date.now()}`;
  const secret = `smoke-secret-${Date.now()}`;
  const createResponse = await apiRequest({
    method: 'POST',
    path: '/purchase-platforms',
    token: adminToken,
    body: {
      name: platformName,
      description: 'Plataforma mock criada automaticamente pelo smoke pos-deploy',
      type: 'SHOPEE',
      appId: `smoke-app-${Date.now()}`,
      secret,
      isActive: true,
      mockMode: true,
      apiUrl: 'https://open-api.affiliate.shopee.com.br/graphql',
      apiLink: 'https://open-api.affiliate.shopee.com.br/graphql',
      accessKey: secret
    }
  });

  assert(createResponse.status === 201, `Falha ao criar plataforma mock. status=${createResponse.status}`);
  assert(createResponse.data?.platform?.id, 'Plataforma mock criada sem ID.');

  created.platformId = createResponse.data.platform.id;
  return createResponse.data.platform;
};

const ensureCompany = async ({ adminToken, platformId }) => {
  const listResponse = await apiRequest({
    method: 'GET',
    path: '/companies',
    token: adminToken
  });

  assert(listResponse.status === 200, `Falha ao listar empresas. status=${listResponse.status}`);
  const companies = Array.isArray(listResponse.data?.companies) ? listResponse.data.companies : [];

  const existing = companies.find((company) => company.name === SMOKE_COMPANY_NAME);
  if (existing) {
    const updateResponse = await apiRequest({
      method: 'PUT',
      path: `/companies/${existing.id}`,
      token: adminToken,
      body: {
        shopeeMode: 'TEST',
        shopeePlatformId: platformId,
        shopeePlatformTestId: platformId
      }
    });

    assert(updateResponse.status === 200, `Falha ao atualizar empresa de smoke. status=${updateResponse.status}`);
    return updateResponse.data.company;
  }

  const createResponse = await apiRequest({
    method: 'POST',
    path: '/companies',
    token: adminToken,
    body: {
      name: SMOKE_COMPANY_NAME,
      shopeeMode: 'TEST',
      shopeePlatformId: platformId,
      shopeePlatformTestId: platformId
    }
  });

  assert(createResponse.status === 201, `Falha ao criar empresa de smoke. status=${createResponse.status}`);
  assert(createResponse.data?.company?.id, 'Empresa de smoke criada sem ID.');

  created.companyId = createResponse.data.company.id;
  return createResponse.data.company;
};

const cleanupData = async (adminToken) => {
  if (KEEP_DATA) {
    return;
  }

  if (created.employeeId) {
    await apiRequest({
      method: 'DELETE',
      path: `/users/${created.employeeId}`,
      token: adminToken
    });
  }

  if (created.ownerId) {
    await apiRequest({
      method: 'DELETE',
      path: `/users/${created.ownerId}`,
      token: adminToken
    });
  }

  if (created.platformId) {
    await apiRequest({
      method: 'DELETE',
      path: `/purchase-platforms/${created.platformId}`,
      token: adminToken
    });
  }
};

const printSummaryAndExit = (success, error) => {
  console.log('\n=== Smoke Summary ===');
  checks.forEach((check) => {
    console.log(`${check.ok ? 'OK' : 'FAIL'} ${check.name}${check.message ? ` - ${check.message}` : ''}`);
  });

  if (!KEEP_DATA) {
    console.log('Cleanup: habilitado (dados temporarios removidos quando possivel).');
  } else {
    console.log('Cleanup: desabilitado (POST_DEPLOY_SMOKE_KEEP_DATA=true).');
  }

  console.log(`BASE_URL=${BASE_URL}`);

  if (success) {
    console.log('POST_DEPLOY_SMOKE_OK');
    process.exit(0);
  }

  const message = error instanceof Error ? error.message : String(error);
  console.error(`POST_DEPLOY_SMOKE_FAIL: ${message}`);
  process.exit(1);
};

(async () => {
  let adminToken = '';
  let ownerToken = '';
  let ownerUsername = '';
  let ownerTwoFactorSecret = '';

  try {
    await runCheck('health', async () => {
      const response = await apiRequest({ method: 'GET', path: '/health' });
      assert(response.status === 200, `status inesperado: ${response.status}`);
      assert(response.data?.status === 'ok', 'payload de health invalido.');
    });

    await runCheck('admin_login', async () => {
      const loginResponse = await login({
        identifier: ADMIN_IDENTIFIER,
        password: ADMIN_PASSWORD,
        twoFactorCode: ADMIN_2FA_CODE
      });

      adminToken = loginResponse.token;
      assert(adminToken, 'token de admin ausente.');
    });

    await runCheck('admin_me', async () => {
      const response = await apiRequest({
        method: 'GET',
        path: '/auth/me',
        token: adminToken
      });

      assert(response.status === 200, `status inesperado: ${response.status}`);
      assert(response.data?.user?.role === 'ADMIN', 'usuario autenticado nao e ADMIN.');
    });

    let platform;
    await runCheck('ensure_mock_platform', async () => {
      platform = await ensureMockPlatform(adminToken);
      assert(platform?.id, 'plataforma invalida.');
    });

    let company;
    await runCheck('ensure_company_for_smoke', async () => {
      company = await ensureCompany({
        adminToken,
        platformId: platform.id
      });
      assert(company?.id, 'empresa invalida.');
    });

    await runCheck('create_owner_user', async () => {
      ownerUsername = `smoke_owner_${Date.now()}`;
      const response = await apiRequest({
        method: 'POST',
        path: '/users',
        token: adminToken,
        body: {
          fullName: 'Smoke Owner',
          username: ownerUsername,
          email: `${ownerUsername}@smoke.local`,
          password: OWNER_PASSWORD,
          role: 'USER',
          companyId: company.id,
          companyRole: 'OWNER'
        }
      });

      assert(response.status === 201, `status inesperado: ${response.status}`);
      assert(response.data?.user?.id, 'owner criado sem ID.');
      created.ownerId = response.data.user.id;
      created.ownerUsername = ownerUsername;
    });

    await runCheck('owner_login', async () => {
      const loginResponse = await login({
        identifier: ownerUsername,
        password: OWNER_PASSWORD
      });

      ownerToken = loginResponse.token;
      assert(ownerToken, 'token de owner ausente.');
    });

    await runCheck('owner_me', async () => {
      const response = await apiRequest({
        method: 'GET',
        path: '/auth/me',
        token: ownerToken
      });

      assert(response.status === 200, `status inesperado: ${response.status}`);
      assert(response.data?.user?.companyRole === 'OWNER', 'usuario autenticado nao e OWNER.');
      assert(response.data?.user?.companyId === company.id, 'owner nao esta na empresa esperada.');
    });

    await runCheck('owner_create_employee', async () => {
      const employeeUsername = `smoke_employee_${Date.now()}`;
      const response = await apiRequest({
        method: 'POST',
        path: '/users/employees',
        token: ownerToken,
        body: {
          fullName: 'Smoke Employee',
          username: employeeUsername,
          email: `${employeeUsername}@smoke.local`,
          password: EMPLOYEE_PASSWORD
        }
      });

      assert(response.status === 201, `status inesperado: ${response.status}`);
      assert(response.data?.user?.id, 'funcionario criado sem ID.');
      created.employeeId = response.data.user.id;
    });

    let originUrl = '';
    let shortLink = '';
    await runCheck('owner_generate_shopee_shortlink', async () => {
      originUrl = `https://example.com/smoke-${Date.now()}`;
      const response = await apiRequest({
        method: 'POST',
        path: '/integrations/shopee/generate-shortlinks',
        token: ownerToken,
        body: {
          originUrls: [originUrl],
          subId1: ownerUsername
        }
      });

      assert(response.status === 200, `status inesperado: ${response.status}`);
      const firstResult = Array.isArray(response.data?.results) ? response.data.results[0] : null;
      assert(firstResult && firstResult.success === true, 'geracao de shortlink falhou.');
      assert(typeof firstResult.shortLink === 'string' && firstResult.shortLink.length > 0, 'shortlink ausente.');
      shortLink = firstResult.shortLink;
    });

    await runCheck('owner_save_generated_link', async () => {
      const response = await apiRequest({
        method: 'POST',
        path: '/affiliate-links',
        token: ownerToken,
        body: {
          generatedLinks: [{ originUrl, shortLink }],
          subId1: ownerUsername
        }
      });

      assert(response.status === 201, `status inesperado: ${response.status}`);
      assert(Array.isArray(response.data?.links) && response.data.links.length > 0, 'link gerado nao foi salvo.');
    });

    await runCheck('owner_2fa_setup_confirm', async () => {
      const setupResponse = await apiRequest({
        method: 'POST',
        path: '/auth/2fa/setup',
        token: ownerToken,
        body: {}
      });

      assert(setupResponse.status === 200, `status inesperado no setup: ${setupResponse.status}`);
      assert(typeof setupResponse.data?.otpauthUrl === 'string', 'setup 2FA sem otpauthUrl.');
      ownerTwoFactorSecret = parseSecretFromOtpAuth(setupResponse.data.otpauthUrl);

      const confirmResponse = await requestWithTotpRetries({
        token: ownerToken,
        path: '/auth/2fa/confirm',
        secret: ownerTwoFactorSecret,
        contextLabel: 'status inesperado no confirm'
      });

      assert(
        Array.isArray(confirmResponse.data?.backupCodes) && confirmResponse.data.backupCodes.length > 0,
        'confirmacao 2FA sem backup codes.'
      );
    });

    await runCheck('owner_login_with_2fa_challenge', async () => {
      const challengeResponse = await apiRequest({
        method: 'POST',
        path: '/auth/login',
        body: {
          identifier: ownerUsername,
          password: OWNER_PASSWORD
        }
      });

      assert(challengeResponse.status === 200, `status inesperado no login com 2FA: ${challengeResponse.status}`);
      const tempToken = challengeResponse.data?.tempToken || challengeResponse.data?.challengeId;
      assert(tempToken, 'login nao retornou challenge 2FA.');

      const verifyResponse = await requestWithTotpRetries({
        path: '/auth/login/2fa',
        tempToken,
        secret: ownerTwoFactorSecret,
        contextLabel: 'status inesperado na validacao 2FA'
      });

      assert(typeof verifyResponse.data?.token === 'string', 'validacao 2FA sem token.');
    });

    await runCheck('cleanup', async () => {
      await cleanupData(adminToken);
    });

    printSummaryAndExit(true);
  } catch (error) {
    try {
      if (adminToken) {
        await cleanupData(adminToken);
      }
    } catch (cleanupError) {
      const message = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      console.error(`WARN cleanup falhou: ${message}`);
    }

    printSummaryAndExit(false, error);
  }
})();
