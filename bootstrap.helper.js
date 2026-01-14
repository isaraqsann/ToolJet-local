"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
exports.rawBodyBuffer = rawBodyBuffer;
exports.handleLicensingInit = handleLicensingInit;
exports.initializeOtel = initializeOtel;
exports.replaceSubpathPlaceHoldersInStaticAssets = replaceSubpathPlaceHoldersInStaticAssets;
exports.initSentry = initSentry;
exports.setSecurityHeaders = setSecurityHeaders;
exports.buildVersion = buildVersion;
exports.setupGlobalAgent = setupGlobalAgent;
exports.logStartupInfo = logStartupInfo;
exports.logShutdownInfo = logShutdownInfo;
const global_agent_1 = require("global-agent");
const path_1 = require("path");
const helmet_1 = require("helmet");
const fs = require("fs");
const IService_1 = require("../modules/licensing/interfaces/IService");
const constants_1 = require("../modules/app/constants");
const utils_helper_1 = require("./utils.helper");
const Sentry = require("@sentry/nestjs");
function createLogger(context) {
    return {
        log: (message, ...optionalParams) => {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [${context}] ${message}`, ...optionalParams);
        },
        error: (message, error) => {
            const timestamp = new Date().toISOString();
            console.error(`[${timestamp}] [${context}] ERROR: ${message}`, error);
        },
        warn: (message, ...optionalParams) => {
            const timestamp = new Date().toISOString();
            console.warn(`[${timestamp}] [${context}] WARN: ${message}`, ...optionalParams);
        },
    };
}
function rawBodyBuffer(req, res, buf, encoding) {
    if (buf && buf.length) {
        req.rawBody = buf.toString(encoding || 'utf8');
    }
}
async function handleLicensingInit(app, logger) {
    var _a;
    const tooljetEdition = (0, utils_helper_1.getTooljetEdition)();
    logger.log(`Current edition: ${tooljetEdition}`);
    if (tooljetEdition !== constants_1.TOOLJET_EDITIONS.EE) {
        logger.log('Skipping licensing initialization for non-EE edition');
        return;
    }
    try {
        logger.log('Initializing Enterprise Edition licensing...');
        const importPath = await (0, constants_1.getImportPath)(false, tooljetEdition);
        const { LicenseUtilService } = await Promise.resolve(`${`${importPath}/licensing/util.service`}`).then(s => require(s));
        const licenseInitService = app.get(IService_1.LicenseInitService);
        const licenseUtilService = app.get(LicenseUtilService);
        logger.log('Calling license initialization service...');
        await licenseInitService.init();
        logger.log('✅ License initialization completed');
        logger.log('Loading license configuration...');
        const License = await Promise.resolve(`${`${importPath}/licensing/configs/License`}`).then(s => require(s));
        const license = License.default;
        logger.log('Validating hostname and subpath...');
        licenseUtilService.validateHostnameSubpath((_a = license.Instance()) === null || _a === void 0 ? void 0 : _a.domains);
        const licenseInfo = license.Instance();
        logger.log(`✅ License validation completed`);
        logger.log(`License valid: ${licenseInfo.isValid}`);
        logger.log(`License terms: ${JSON.stringify(licenseInfo.terms)}`);
        console.log(`License valid : ${licenseInfo.isValid} License Terms : ${JSON.stringify(licenseInfo.terms)} 🚀`);
    }
    catch (error) {
        logger.error('❌ Failed to initialize licensing:', error);
        throw error;
    }
}
async function initializeOtel(app, logger) {
    if (process.env.ENABLE_OTEL !== 'true') {
        if (process.env.OTEL_LOG_LEVEL === 'debug') {
            logger.log('⏭️ OTEL disabled (ENABLE_OTEL not set to true)');
        }
        return;
    }
    try {
        const tooljetEdition = (0, utils_helper_1.getTooljetEdition)();
        if (tooljetEdition !== constants_1.TOOLJET_EDITIONS.EE && tooljetEdition !== constants_1.TOOLJET_EDITIONS.Cloud) {
            if (process.env.OTEL_LOG_LEVEL === 'debug') {
                logger.log('⏭️ OTEL skipped - not Enterprise or Cloud edition');
            }
            return;
        }
        if (process.env.OTEL_LOG_LEVEL === 'debug') {
            logger.log('🔭 Applying OpenTelemetry middleware...');
        }
        const { otelMiddleware } = await Promise.resolve().then(() => require('../otel/tracing'));
        const expressApp = app.getHttpAdapter().getInstance();
        expressApp.use(otelMiddleware);
        if (process.env.OTEL_LOG_LEVEL === 'debug') {
            logger.log('✅ OpenTelemetry middleware applied successfully');
            logger.log('   - SDK: Already started at import time');
            logger.log('   - Tracing: Enabled');
            logger.log('   - Metrics: Enabled');
            logger.log('   - Auto-instrumentation: Active');
        }
    }
    catch (error) {
        logger.error('❌ Failed to initialize OpenTelemetry:', error);
    }
}
function replaceSubpathPlaceHoldersInStaticAssets(logger) {
    logger.log('Starting subpath placeholder replacement...');
    const buildDir = (0, path_1.join)(__dirname, '../../../../', 'frontend/build');
    const allFiles = fs.readdirSync(buildDir);
    const filesToReplaceAssetPath = [
        'index.html',
        ...allFiles.filter((f) => /^runtime(\.[a-f0-9]+)?\.js$/.test(f)),
        ...allFiles.filter((f) => /^main(\.[a-f0-9]+)?\.js$/.test(f)),
    ];
    logger.log(`Files to process: ${filesToReplaceAssetPath.join(', ')}`);
    for (const fileName of filesToReplaceAssetPath) {
        try {
            const file = (0, path_1.join)(buildDir, fileName);
            logger.log(`Processing file: ${fileName}`);
            let newValue = process.env.SUB_PATH;
            if (process.env.SUB_PATH === undefined) {
                newValue = fileName === 'index.html' ? '/' : '';
                logger.log(`Using default value for ${fileName}: "${newValue}"`);
            }
            else {
                logger.log(`Using SUB_PATH value for ${fileName}: "${newValue}"`);
            }
            if (!fs.existsSync(file)) {
                logger.warn(`File not found: ${file}`);
                continue;
            }
            const data = fs.readFileSync(file, { encoding: 'utf8' });
            const result = data
                .replace(/__REPLACE_SUB_PATH__\/api/g, (0, path_1.join)(newValue, '/api'))
                .replace(/__REPLACE_SUB_PATH__/g, newValue);
            fs.writeFileSync(file, result, { encoding: 'utf8' });
            logger.log(`✅ Successfully processed: ${fileName}`);
        }
        catch (error) {
            logger.error(`❌ Failed to process ${fileName}:`, error);
        }
    }
    logger.log('✅ Subpath placeholder replacement completed');
}
function initSentry(logger, configService) {
    if (configService.get('APM_VENDOR') !== 'sentry')
        return;
    logger.log('Initializing Sentry...');
    try {
        Sentry.init({
            dsn: configService.get('SENTRY_DNS'),
            tracesSampleRate: 1.0,
            environment: configService.get('NODE_ENV') || 'development',
            debug: !!configService.get('SENTRY_DEBUG'),
            sendDefaultPii: true,
        });
    }
    catch (error) {
        logger.error('❌ Failed to set Sentry options:', error);
    }
    logger.log('✅ Sentry initialization completed');
}
function setSecurityHeaders(app, configService, logger) {
    var _a;
    logger.log('Setting up security headers...');
    try {
        const tooljetHost = configService.get('TOOLJET_HOST');
        const host = new URL(tooljetHost);
        const domain = host.hostname;
        logger.log(`Configuring CORS for domain: ${domain}`);
        logger.log(`CORS enabled: ${configService.get('ENABLE_CORS') === 'true'}`);
        app.enableCors({
            origin: configService.get('ENABLE_CORS') === 'true' || tooljetHost,
            credentials: true,
            maxAge: 86400,
        });
        const cspWhitelistedDomains = ((_a = configService.get('CSP_WHITELISTED_DOMAINS')) === null || _a === void 0 ? void 0 : _a.split(',')) || [];
        logger.log(`CSP whitelisted domains: ${cspWhitelistedDomains.join(', ')}`);
        app.use((0, helmet_1.default)({
            contentSecurityPolicy: {
                useDefaults: true,
                directives: {
                    upgradeInsecureRequests: null,
                    'img-src': ['*', 'data:', 'blob:'],
                    'script-src': [
                        'maps.googleapis.com',
                        'storage.googleapis.com',
                        "'sha256-R19NTJL8MAaIzO751fXIQLIQoMUEw78UgCAiavaxN0U='",
                        'apis.google.com',
                        'accounts.google.com',
                        'https://www.gstatic.com',  // <- ini untuk firebase
                        "'self'",
                        "'unsafe-inline'",
                        "'unsafe-eval'",
                        'blob:',
                        'https://unpkg.com/@babel/standalone@7.17.9/babel.min.js',
                        'https://unpkg.com/react@16.7.0/umd/react.production.min.js',
                        'https://unpkg.com/react-dom@16.7.0/umd/react-dom.production.min.js',
                        'cdn.skypack.dev',
                        'cdn.jsdelivr.net',
                        'https://esm.sh',
                        'www.googletagmanager.com',
                    ].concat(cspWhitelistedDomains),
                    'object-src': ["'self'", 'data:'],
                    'media-src': ["'self'", 'data:'],
                    'default-src': [
                        'maps.googleapis.com',
                        'storage.googleapis.com',
                        'https://www.gstatic.com',
                        'apis.google.com',
                        'accounts.google.com',
                        '*.sentry.io',
                        "'self'",
                        'blob:',
                        'www.googletagmanager.com',
                    ].concat(cspWhitelistedDomains),
                    'connect-src': ['ws://' + domain, "'self'", '*', 'data:'],
                    'frame-ancestors': ['*'],
                    'frame-src': ['*'],
                },
            },
            frameguard: configService.get('DISABLE_APP_EMBED') !== 'true' ? false : { action: 'deny' },
            hidePoweredBy: true,
            referrerPolicy: {
                policy: 'no-referrer',
            },
        }));
        logger.log(`Frame embedding ${configService.get('DISABLE_APP_EMBED') !== 'true' ? 'enabled' : 'disabled'}`);
        const subPath = configService.get('SUB_PATH');
        app.use((req, res, next) => {
            res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=()');
            res.setHeader('X-Powered-By', 'ToolJet');
            if (req.path.startsWith(`${subPath || '/'}api/`)) {
                res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            }
            else {
                res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
            }
            return next();
        });
        logger.log('✅ Security headers configured successfully');
    }
    catch (error) {
        logger.error('❌ Failed to configure security headers:', error);
        throw error;
    }
}
function buildVersion(logger) {
    try {
        logger.log('Reading version from .version file...');
        const rawVersion = fs.readFileSync('./.version', 'utf8').trim();
        logger.log(`Raw version: ${rawVersion}`);
        const ltsRegex = /-lts$/i;
        const edition = (0, utils_helper_1.getTooljetEdition)();
        let version;
        if (ltsRegex.test(rawVersion)) {
            const baseVersion = rawVersion.replace(ltsRegex, '');
            version = `${baseVersion}-${edition}-lts`;
            logger.log(`LTS version detected. Built version: ${version}`);
        }
        else {
            version = `${rawVersion}-${edition}`;
            logger.log(`Standard version. Built version: ${version}`);
        }
        return version;
    }
    catch (error) {
        logger.error('❌ Failed to build version:', error);
        throw error;
    }
}
function setupGlobalAgent() {
    const logger = createLogger('GlobalAgent');
    if (process.env.TOOLJET_HTTP_PROXY) {
        logger.log(`Setting up global HTTP proxy: ${process.env.TOOLJET_HTTP_PROXY}`);
        process.env['GLOBAL_AGENT_HTTP_PROXY'] = process.env.TOOLJET_HTTP_PROXY;
        (0, global_agent_1.bootstrap)();
        logger.log('✅ Global HTTP proxy configured');
    }
    else {
        logger.log('No HTTP proxy configured');
    }
}
function logStartupInfo(configService, logger) {
    const tooljetHost = configService.get('TOOLJET_HOST');
    const subPath = configService.get('SUB_PATH');
    const corsEnabled = configService.get('ENABLE_CORS') === 'true';
    const edition = (0, utils_helper_1.getTooljetEdition)();
    const version = globalThis.TOOLJET_VERSION;
    logger.log('='.repeat(60));
    logger.log('🚀 TOOLJET APPLICATION STARTED SUCCESSFULLY');
    logger.log('='.repeat(60));
    logger.log(`Edition: ${edition}`);
    logger.log(`Version: ${version}`);
    logger.log(`Host: ${tooljetHost}${subPath || ''}`);
    logger.log(`Subpath: ${subPath || 'None'}`);
    logger.log(`CSP Whitelisted Domains: ${configService.get('CSP_WHITELISTED_DOMAINS') || 'None'}`);
    logger.log(`CORS Enabled: ${corsEnabled}`);
    logger.log(`global HTTP proxy: ${configService.get('TOOLJET_HTTP_PROXY') || 'Not configured'}`);
    logger.log(`Frame embedding: ${configService.get('DISABLE_APP_EMBED') !== 'true' ? 'enabled' : 'disabled'}`);
    logger.log(`Metrics Enabled: ${configService.get('ENABLE_METRICS') === 'true'}`);
    const otelEnabled = configService.get('ENABLE_OTEL') === 'true';
    logger.log(`OpenTelemetry: ${otelEnabled ? 'Enabled' : 'Disabled'}`);
    if (otelEnabled) {
        logger.log(`  - Tracing: ${otelEnabled ? 'Active' : 'Inactive'}`);
        logger.log(`  - Metrics: ${otelEnabled ? 'Active' : 'Inactive'}`);
        logger.log(`  - App Metrics: ${otelEnabled ? 'Active' : 'Inactive'}`);
    }
    logger.log(`Environment: ${configService.get('NODE_ENV') || 'development'}`);
    logger.log(`Port: ${configService.get('PORT') || 3000}`);
    logger.log(`Listen Address: ${configService.get('LISTEN_ADDR') || '::'}`);
    logger.log('='.repeat(60));
    logger.log(`Custom ORM logger: ${configService.get('DISABLE_CUSTOM_QUERY_LOGGING') !== 'true' ? 'enabled' : 'disabled'}`);
    logger.log(`Custom ORM logger logging level: ${configService.get('CUSTOM_QUERY_LOGGING_LEVEL') || 'Not - configured'}`);
    logger.log(`ORM logging level: ${configService.get('ORM_LOGGING') || 'Not - configured'}`);
    logger.log(`ORM Slow Query logging threshold in ms: ${configService.get('ORM_SLOW_QUERY_LOGGING_THRESHOLD') || 'Not - configured'}`);
    logger.log(`Transaction logging level: ${configService.get('TRANSACTION_LOGGING_LEVEL') || 'Not - configured'}`);
    logger.log(`Metrics Enabled: ${configService.get('ENABLE_METRICS') === 'true'}`);
    logger.log('='.repeat(60));
}
function logShutdownInfo(signal, logger) {
    logger.log('='.repeat(60));
    logger.log(`🛑 ${signal} SIGNAL RECEIVED - SHUTTING DOWN`);
    logger.log('='.repeat(60));
    logger.log('Gracefully closing application...');
}
//# sourceMappingURL=bootstrap.helper.js.map