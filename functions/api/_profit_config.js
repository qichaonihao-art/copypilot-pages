export const PROFIT_CONFIG_KEY = 'PROFIT_CALCULATOR_CONFIG';

export const PROFIT_VARIABLES = [
  'orders',
  'price',
  'roi',
  'returnRate',
  'cost',
  'insurance',
  'serviceRate'
];

export const DEFAULT_PROFIT_CONFIG = {
  formulas: {
    grossGmv: 'orders * price',
    adCost: 'grossGmv / roi',
    settledOrders: 'orders * (1 - returnRate)',
    settledGmv: 'settledOrders * price',
    platformFee: 'settledGmv * serviceRate',
    productCostTotal: 'settledOrders * cost',
    insuranceTotal: 'settledOrders * insurance',
    profit: 'settledGmv - adCost - platformFee - productCostTotal - insuranceTotal',
    profitPerOrder: 'profit / orders',
    profitPerSettledOrder: 'profit / settledOrders'
  },
  updatedAt: null
};

export const PROFIT_FORMULA_LABELS = {
  grossGmv: '总GMV',
  adCost: '广告费',
  settledOrders: '有效成交单量',
  settledGmv: '有效成交GMV',
  platformFee: '平台技术服务费',
  productCostTotal: '货款成本',
  insuranceTotal: '运费险',
  profit: '最终利润',
  profitPerOrder: '按下单数单均利润',
  profitPerSettledOrder: '按成交数单均利润'
};

const FORMULA_KEYS = Object.keys(DEFAULT_PROFIT_CONFIG.formulas);
const ALLOWED_NAMES = new Set([...PROFIT_VARIABLES, ...FORMULA_KEYS]);

export function normalizeProfitConfig(input = {}) {
  const formulas = {
    ...DEFAULT_PROFIT_CONFIG.formulas,
    ...(input?.formulas || {})
  };
  return {
    formulas: Object.fromEntries(FORMULA_KEYS.map((key) => [key, String(formulas[key] || '').trim()])),
    updatedAt: input?.updatedAt || null
  };
}

export function validateProfitConfig(input = {}) {
  const config = normalizeProfitConfig(input);
  const errors = [];

  for (const [key, formula] of Object.entries(config.formulas)) {
    const error = validateFormula(formula);
    if (error) errors.push(`${PROFIT_FORMULA_LABELS[key] || key}：${error}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    config
  };
}

export function validateFormula(formula) {
  const text = String(formula || '').trim();
  if (!text) return '公式不能为空';
  if (text.length > 240) return '公式太长，请控制在 240 个字符以内';
  if (!/^[\w\s+\-*/().]+$/.test(text)) return '只能使用变量、数字、括号和 + - * /';

  const names = text.match(/[A-Za-z_]\w*/g) || [];
  const unknown = names.find((name) => !ALLOWED_NAMES.has(name));
  if (unknown) return `未知变量 ${unknown}`;

  let balance = 0;
  for (const char of text) {
    if (char === '(') balance += 1;
    if (char === ')') balance -= 1;
    if (balance < 0) return '括号不匹配';
  }
  if (balance !== 0) return '括号不匹配';

  return '';
}
