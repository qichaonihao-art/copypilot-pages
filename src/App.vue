<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  BadgeCheck,
  Calculator,
  Captions,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Copy,
  FileAudio,
  FileText,
  FileVideo,
  History,
  Image,
  Link,
  Loader2,
  RotateCcw,
  Save,
  Settings,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Zap,
} from 'lucide-vue-next';
import { seoPageByPath } from './seo-pages.js';

const siteName = 'CopyPilot';
const FREE_TRANSCRIBE_MAX_SECONDS = 5 * 60;
const SHARED_VIEWED_KEY = 'copypilot-shared-viewed-v1';
const PROFIT_FORM_STORAGE_KEY = 'copypilot-profit-form-v1';
const initialPath = window.location.pathname;
const currentPath = ref(initialPath);
const lang = ref(initialPath.startsWith('/en/') ? 'en' : localStorage.getItem('copypilot-lang') || 'zh');
const url = ref('');
const urlInput = ref(null);
const fileMode = ref('video');
const textMode = ref('link');
const articleView = ref('text');
const articleTemplate = ref('clean');
const articleDraftHtml = ref('');
const articleRewriteLoading = ref(false);
const videoTranscriptLoading = ref(false);
const transcriptMode = ref('');
const transcriptProgress = ref({ stage: 'idle', message: '' });
const transcriptLiveText = ref('');
const transcriptHistoryOpen = ref(false);
const transcriptHistory = ref(loadTranscriptHistory());
const transcriptCopyDone = ref(false);
const configOpen = ref(false);
const configLoading = ref(false);
const configWechatCookie = ref('');
const configTestUrl = ref('');
const configMessage = ref('');
const configMessageType = ref('success');
const wechatCookieStatus = ref({
  configured: false,
  storageConfigured: false,
  updatedAt: null,
  preview: '',
  lastTestAt: null,
  lastTestResult: null
});
const sharedVideos = ref([]);
const sharedLoading = ref(false);
const sharedError = ref('');
const sharedMessage = ref('');
const shareLoading = ref(false);
const currentSharedRecord = ref(null);
const viewedSharedIds = ref(loadViewedSharedIds());
const profitLoading = ref(false);
const profitConfigOpen = ref(false);
const profitMessage = ref('');
const profitMessageType = ref('success');
const profitStorageConfigured = ref(true);
const profitFormulaEditorOpen = ref(false);
const profitFormulaEditorKey = ref('');
const profitFormulaDraft = ref('');
const profitForm = ref(loadProfitForm());
let previousProfitOrderCount = Number(profitForm.value.orderCount) || 0;
const profitConfig = ref(defaultProfitConfig());
const selectedFile = ref(null);
const loading = ref(false);
const error = ref('');
const notice = ref('');
const result = ref(null);
const extractProgress = ref(null);
const authOpen = ref(false);
const authLoading = ref(false);
const authEmail = ref('');
const authCode = ref('');
const authMessage = ref('');
const currentUser = ref(null);
const usage = ref(null);
const records = ref([]);
const adminUsers = ref([]);
const adminTotal = ref(0);
const adminPlans = ref([]);
const siteContent = ref(null);
const adminSiteContent = ref(null);
const adminCopyLang = ref('zh');
const adminLoading = ref(false);
const adminMessage = ref('');
const devCode = ref('');
const isPublicFreeMode = !['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
const openFaqIndex = ref(0);
const PROFIT_CONFIG_VERSION = '2026-07-18-roi-dual-v4';
let transcriptCopyTimer = null;

function toggleFaq(index) {
  openFaqIndex.value = openFaqIndex.value === index ? -1 : index;
}

const profitFormulaMeta = [
  { key: 'grossGmv', label: '销售GMV', hint: '平台产生的下单成交金额，还没有扣退货、运费险、平台服务费、广告费和货款。' },
  { key: 'adCost', label: '广告费', hint: '广告费一般等于销售GMV / ROI；调整后方案会使用调整后 ROI。' },
  { key: 'settledOrders', label: '有效成交单量', hint: '扣掉发货前退货和发货后退货后的最终成交单数。' },
  { key: 'settledGmv', label: '有效成交GMV', hint: '扣掉发货前退货和发货后退货后的成交金额。' },
  { key: 'shippedOrders', label: '已发货单量', hint: '扣掉发货前退货后的发货单数，用来计算运费险。' },
  { key: 'productCostTotal', label: '货款成本', hint: '默认只按最终成交单支付货款。' },
  { key: 'insuranceTotal', label: '运费险', hint: '按已发货单量扣，发货前退货不扣，发货后退货仍要扣。' },
  { key: 'withdrawBase', label: '提现前余额', hint: '有效成交GMV扣掉运费险后，进入平台扣点前的余额；广告费不参与平台扣点。' },
  { key: 'platformFee', label: '平台技术服务费', hint: '按有效成交GMV扣掉运费险后的提现前余额计算。' },
  { key: 'profit', label: '最终利润', hint: '提现到账金额再扣货款后的最终利润。' },
  { key: 'profitPerOrder', label: '下单单均利润', hint: '总利润 / 总下单量，表示每产生一笔下单平均能赚多少钱。' },
  { key: 'profitPerSettledOrder', label: '按成交数单均利润', hint: '总利润 / 有效成交单量，更适合看最终成交订单利润。' },
  { key: 'actualGrossMarginRate', label: '实际毛利率', hint: '不含广告费前的利润空间 / 销售GMV；广告口径保本 ROI = 1 / 实际毛利率。' },
  { key: 'breakEvenRoi', label: '广告口径保本 ROI', hint: '和广告后台 ROI 同口径，用销售GMV作为基准；广告 ROI 至少达到这个数才保本。' },
  { key: 'collectionBreakEvenRoi', label: '回款口径保本 ROI', hint: '用有效成交GMV作为基准，更接近最终回款视角的保本线。' }
];

const profitVariableLabels = [
  ['orders', '下单量'],
  ['price', '单均成交价'],
  ['roi', '广告ROI'],
  ['returnRate', '总退货率，小数'],
  ['preShipReturnRate', '发货前退货率，小数'],
  ['postShipReturnRate', '发货后退货率，小数'],
  ['cost', '单均货款成本'],
  ['insurance', '单均运费险'],
  ['serviceRate', '平台服务费比例，小数']
];

function defaultProfitConfig() {
  return {
    version: PROFIT_CONFIG_VERSION,
    updatedAt: null,
    formulas: {
      grossGmv: 'orders * price',
      adCost: 'grossGmv / roi',
      settledOrders: 'orders * (1 - returnRate)',
      settledGmv: 'settledOrders * price',
      shippedOrders: 'orders * (1 - preShipReturnRate)',
      productCostTotal: 'settledOrders * cost',
      insuranceTotal: 'shippedOrders * insurance',
      withdrawBase: 'settledGmv - insuranceTotal',
      platformFee: 'withdrawBase * serviceRate',
      profit: 'withdrawBase - platformFee - adCost - productCostTotal',
      profitPerOrder: 'profit / orders',
      profitPerSettledOrder: 'profit / settledOrders',
      actualGrossMarginRate: '(withdrawBase * (1 - serviceRate) - productCostTotal) / grossGmv',
      breakEvenRoi: '1 / actualGrossMarginRate',
      collectionBreakEvenRoi: 'settledGmv / (withdrawBase * (1 - serviceRate) - productCostTotal)'
    }
  };
}

const pageMap = {
  '/video': {
    badge: '提取视频',
    title: '视频提取工具',
    subtitle: '输入作品链接，一键提取视频文件，适合保存素材、二创剪辑和内容归档。',
    type: 'video',
    theme: 'cyan'
  },
  '/text': {
    badge: '提取文案',
    title: '文案提取工具',
    subtitle: '支持链接提取文案，也支持本地音视频文件转写文案。',
    type: 'text',
    theme: 'indigo'
  },
  '/image-text': {
    badge: '提取图文',
    title: '图文提取工具',
    subtitle: '输入图文作品链接，提取图片素材、标题、正文和标签。',
    type: 'image',
    theme: 'pink'
  },
  '/article': {
    badge: '提取文章',
    title: '公众号文章提取工具',
    subtitle: '输入公众号文章或网页文章链接，提取文章标题、正文、原文图片和基础信息。',
    type: 'article',
    theme: 'green',
    seoTitle: '公众号文章提取工具 - 在线提取文章正文和图片'
  },
  '/wechat-article': {
    badge: '公众号文章提取',
    title: '公众号文章提取工具',
    subtitle: '粘贴公众号文章链接，提取文章标题、正文、原文图片和基础信息。',
    type: 'article',
    theme: 'green',
    seoTitle: '公众号文章提取工具 - 在线提取微信公众号文章'
  },
  '/article-studio': {
    badge: '公众号二创排版',
    title: '公众号文章二创排版工具',
    subtitle: '提取公众号文章正文和图片，AI 二创后生成可编辑的公众号排版稿，复制后可粘贴到公众号后台。',
    type: 'article',
    theme: 'green',
    seoTitle: '公众号文章二创排版工具 - AI 改写并复制公众号格式'
  },
  '/xiaohongshu': {
    badge: '提取文案',
    title: '文案提取工具',
    subtitle: '支持链接提取文案，也支持本地音视频文件转写文案。',
    type: 'text',
    theme: 'indigo'
  },
  '/douyin': {
    badge: '提取文案',
    title: '文案提取工具',
    subtitle: '支持链接提取文案，也支持本地音视频文件转写文案。',
    type: 'text',
    theme: 'indigo'
  },
  '/extract-video': {
    badge: '提取视频',
    title: '视频提取工具',
    subtitle: '输入作品链接，一键提取视频文件，适合保存素材、二创剪辑和内容归档。',
    type: 'video',
    theme: 'cyan'
  },
  '/douyin-image': {
    badge: '提取图文',
    title: '图文提取工具',
    subtitle: '输入图文作品链接，提取图片素材、标题、正文和标签。',
    type: 'image',
    theme: 'pink'
  },
  '/xiaohongshu-image': {
    badge: '提取图文',
    title: '图文提取工具',
    subtitle: '输入图文作品链接，提取图片素材、标题、正文和标签。',
    type: 'image',
    theme: 'pink'
  },
  '/video-extract': {
    badge: '音视频文件',
    title: '音视频文件文案提取工具',
    subtitle: '上传本地视频或音频文件，提取可复制的文字稿。',
    type: 'media-file',
    theme: 'indigo'
  },
  '/audio-extract': {
    badge: '音视频文件',
    title: '音视频文件文案提取工具',
    subtitle: '上传本地视频或音频文件，提取可复制的文字稿。',
    type: 'media-file',
    theme: 'indigo'
  },
  '/media-extract': {
    badge: '音视频文件',
    title: '音视频文件文案提取工具',
    subtitle: '上传本地视频或音频文件，提取可复制的文字稿。适合课程、直播、播客、访谈和会议录音整理。',
    type: 'media-file',
    theme: 'indigo'
  },
  '/douyin-video-download': {
    badge: '抖音视频提取',
    title: '抖音视频提取工具',
    subtitle: '粘贴抖音作品链接，提取视频预览、下载链接、作品标题、发布文案和话题标签。',
    type: 'video',
    theme: 'cyan',
    seoTitle: '抖音视频提取工具 - 在线提取抖音视频和文案'
  },
  '/xiaohongshu-image-download': {
    badge: '小红书图文提取',
    title: '小红书图文图片提取工具',
    subtitle: '粘贴小红书笔记链接，提取图文笔记的图片素材、标题、正文和话题标签。',
    type: 'image',
    theme: 'pink',
    seoTitle: '小红书图文图片提取工具 - 在线提取笔记图片和文案'
  },
  '/tiktok-video-download': {
    badge: 'TikTok视频提取',
    title: 'TikTok 视频提取工具',
    subtitle: '粘贴 TikTok 分享链接，提取视频素材、标题、发布文案和标签，适合内容整理和二创剪辑。',
    type: 'video',
    theme: 'cyan',
    seoTitle: 'TikTok 视频提取工具 - 在线提取 TikTok 视频和文案'
  },
  '/kuaishou-video-download': {
    badge: '快手视频提取',
    title: '快手视频提取工具',
    subtitle: '粘贴快手作品链接，提取视频素材、标题、发布文案和话题标签。',
    type: 'video',
    theme: 'cyan',
    seoTitle: '快手视频提取工具 - 在线提取快手视频和文案'
  },
  '/bilibili-video-download': {
    badge: 'B站视频提取',
    title: 'B站视频提取工具',
    subtitle: '粘贴 Bilibili 视频链接，整理视频素材、标题、简介和基础信息。',
    type: 'video',
    theme: 'cyan',
    seoTitle: 'B站视频提取工具 - 在线提取 Bilibili 视频和文案'
  },
  '/youtube-video-download': {
    badge: 'YouTube视频提取',
    title: 'YouTube 视频提取工具',
    subtitle: '粘贴 YouTube 视频链接，提取视频素材、标题、简介和标签信息。',
    type: 'video',
    theme: 'cyan',
    seoTitle: 'YouTube 视频提取工具 - 在线提取 YouTube 视频信息'
  },
  '/weibo-video-download': {
    badge: '微博视频提取',
    title: '微博视频提取工具',
    subtitle: '粘贴微博视频链接，提取视频素材、正文和话题标签。',
    type: 'video',
    theme: 'cyan',
    seoTitle: '微博视频提取工具 - 在线提取微博视频和文案'
  },
  '/instagram-video-download': {
    badge: 'Instagram视频提取',
    title: 'Instagram 视频提取工具',
    subtitle: '粘贴 Instagram Reels 或帖子链接，整理视频素材、说明文字和标签。',
    type: 'video',
    theme: 'cyan',
    seoTitle: 'Instagram 视频提取工具 - 在线提取 Instagram Reels'
  },
  '/instagram-image-download': {
    badge: 'Instagram图文提取',
    title: 'Instagram 图文图片提取工具',
    subtitle: '粘贴 Instagram 帖子链接，提取图片素材、说明文字和标签。',
    type: 'image',
    theme: 'pink',
    seoTitle: 'Instagram 图文图片提取工具 - 在线提取 Instagram 图片'
  },
  '/lemon8-image-download': {
    badge: 'Lemon8图文提取',
    title: 'Lemon8 图文图片提取工具',
    subtitle: '粘贴 Lemon8 图文链接，提取图片素材、标题、正文和标签。',
    type: 'image',
    theme: 'pink',
    seoTitle: 'Lemon8 图文图片提取工具 - 在线提取 Lemon8 图片和文案'
  },
  '/weibo-image-download': {
    badge: '微博图文提取',
    title: '微博图文图片提取工具',
    subtitle: '粘贴微博图文链接，提取图片素材、正文和话题标签。',
    type: 'image',
    theme: 'pink',
    seoTitle: '微博图文图片提取工具 - 在线提取微博图片和文案'
  },
  '/zhihu-article': {
    badge: '知乎文章提取',
    title: '知乎文章提取工具',
    subtitle: '粘贴知乎文章或回答链接，提取标题、正文、图片和基础信息。',
    type: 'article',
    theme: 'green',
    seoTitle: '知乎文章提取工具 - 在线提取知乎正文和图片'
  },
  '/web-article': {
    badge: '网页文章提取',
    title: '网页文章提取工具',
    subtitle: '粘贴网页文章链接，提取文章标题、正文、图片和基础信息。',
    type: 'article',
    theme: 'green',
    seoTitle: '网页文章提取工具 - 在线提取网页正文和图片'
  },
  '/video-to-text': {
    badge: '视频转文字',
    title: '视频转文字工具',
    subtitle: '上传本地视频文件，自动识别视频中的语音内容并整理成可复制文字稿。',
    type: 'media-file',
    theme: 'indigo',
    seoTitle: '视频转文字工具 - 在线提取视频中的语音文案'
  },
  '/audio-to-text': {
    badge: '音频转文字',
    title: '音频转文字工具',
    subtitle: '上传本地音频文件，自动识别语音内容，快速生成可复制的文字稿。',
    type: 'media-file',
    theme: 'indigo',
    seoTitle: '音频转文字工具 - 在线音频转文案'
  },
  '/local-video-to-text': {
    badge: '本地视频转文字',
    title: '本地视频提取文案工具',
    subtitle: '上传本地视频文件，识别视频语音并整理成可复制文字稿。',
    type: 'media-file',
    theme: 'indigo',
    seoTitle: '本地视频提取文案工具 - 视频语音转文字'
  },
  '/local-audio-to-text': {
    badge: '本地音频转文字',
    title: '本地音频提取文案工具',
    subtitle: '上传本地音频文件，识别音频语音并整理成可复制文字稿。',
    type: 'media-file',
    theme: 'indigo',
    seoTitle: '本地音频提取文案工具 - 音频语音转文字'
  },
  '/privacy': {
    badge: '隐私政策',
    title: '隐私政策',
    subtitle: '了解 CopyPilot 如何处理你提交的链接、文件和基础访问数据。',
    type: 'legal',
    theme: 'blue'
  },
  '/terms': {
    badge: '服务条款',
    title: '服务条款',
    subtitle: '使用 CopyPilot 前，请了解基础使用规则、内容责任和服务限制。',
    type: 'legal',
    theme: 'blue'
  },
  '/copyright': {
    badge: '版权说明',
    title: '版权与内容说明',
    subtitle: 'CopyPilot 只提供内容整理能力，素材版权和平台规则需要由使用者自行确认。',
    type: 'legal',
    theme: 'blue'
  },
  '/contact': {
    badge: '联系我们',
    title: '联系我们',
    subtitle: '如果你遇到提取失败、版权问题或产品建议，可以通过邮件联系我们。',
    type: 'legal',
    theme: 'blue'
  }
};

const enPageMap = {
  '/video': { badge: 'Video extractor', title: 'Video Download Tool', subtitle: 'Paste a post link to extract video files for saving, editing, and content archiving.' },
  '/text': { badge: 'Text extractor', title: 'Caption & Transcript Tool', subtitle: 'Extract post captions from links, or upload local audio/video files for speech-to-text.' },
  '/image-text': { badge: 'Image post extractor', title: 'Image & Caption Extractor', subtitle: 'Extract images, titles, captions, and tags from image posts.' },
  '/article': { badge: 'Article extractor', title: 'Article Extraction Tool', subtitle: 'Extract article titles, body text, original images, and basic metadata from article links.' },
  '/wechat-article': { badge: 'WeChat article extractor', title: 'WeChat Article Extractor', subtitle: 'Paste a WeChat article link to extract title, body text, original images, and metadata.' },
  '/article-studio': { badge: 'WeChat article studio', title: 'WeChat Article Rewrite Studio', subtitle: 'Extract, rewrite, format, edit, and copy WeChat-ready article layouts.' },
  '/douyin-video-download': { badge: 'Douyin video download', title: 'Douyin Video Downloader', subtitle: 'Extract Douyin video previews, download links, titles, captions, and hashtags.' },
  '/tiktok-video-download': { badge: 'TikTok video download', title: 'TikTok Video Downloader', subtitle: 'Extract TikTok videos, captions, post text, and tags for content workflows.' },
  '/kuaishou-video-download': { badge: 'Kuaishou video download', title: 'Kuaishou Video Downloader', subtitle: 'Extract Kuaishou videos, titles, captions, and hashtags from shared links.' },
  '/bilibili-video-download': { badge: 'Bilibili video download', title: 'Bilibili Video Downloader', subtitle: 'Extract Bilibili video assets, titles, descriptions, and basic metadata.' },
  '/youtube-video-download': { badge: 'YouTube video download', title: 'YouTube Video Downloader', subtitle: 'Extract YouTube video assets, titles, descriptions, and tags.' },
  '/weibo-video-download': { badge: 'Weibo video download', title: 'Weibo Video Downloader', subtitle: 'Extract Weibo videos, post text, and hashtags.' },
  '/instagram-video-download': { badge: 'Instagram video download', title: 'Instagram Video Downloader', subtitle: 'Extract Instagram Reels or post videos, captions, and tags.' },
  '/xiaohongshu-image-download': { badge: 'Xiaohongshu image extractor', title: 'Xiaohongshu Image Extractor', subtitle: 'Extract images, titles, captions, and hashtags from Xiaohongshu notes.' },
  '/instagram-image-download': { badge: 'Instagram image extractor', title: 'Instagram Image Extractor', subtitle: 'Extract Instagram post images, captions, and tags.' },
  '/lemon8-image-download': { badge: 'Lemon8 image extractor', title: 'Lemon8 Image Extractor', subtitle: 'Extract Lemon8 post images, titles, captions, and tags.' },
  '/weibo-image-download': { badge: 'Weibo image extractor', title: 'Weibo Image Extractor', subtitle: 'Extract Weibo post images, text, and hashtags.' },
  '/zhihu-article': { badge: 'Zhihu article extractor', title: 'Zhihu Article Extractor', subtitle: 'Extract Zhihu article titles, body text, images, and metadata.' },
  '/web-article': { badge: 'Web article extractor', title: 'Web Article Extractor', subtitle: 'Extract article titles, body text, images, and metadata from web pages.' },
  '/video-to-text': { badge: 'Video to text', title: 'Video to Text Tool', subtitle: 'Upload a local video file and convert spoken content into copyable text.' },
  '/audio-to-text': { badge: 'Audio to text', title: 'Audio to Text Tool', subtitle: 'Upload a local audio file and convert speech into copyable text.' },
  '/local-video-to-text': { badge: 'Local video to text', title: 'Local Video Transcript Tool', subtitle: 'Upload local videos and extract speech as editable text.' },
  '/local-audio-to-text': { badge: 'Local audio to text', title: 'Local Audio Transcript Tool', subtitle: 'Upload local audio and extract speech as editable text.' }
};

const uiText = computed(() => {
  const zh = {
    nav: ['首页', '提取视频', '提取文案', '提取图文', '提取文章'],
    login: '登录',
    heroBadge: '免费在线视频文案提取',
    heroTitle: '视频解析与逐字稿提取',
    heroSubtitle: '支持抖音、快手、小红书等多平台链接解析，自动预览视频、提取发布文案，并识别视频语音逐字稿。',
    linkText: '链接提取文案',
    localText: '本地音视频提取文案',
    start: '开始提取',
    loading: '提取中...',
    paste: '粘贴',
    clear: '清空',
    progressTitle: '处理中，请稍候...',
    progressDetect: '正在识别链接类型和内容平台...',
    progressExtract: '正在提取标题、发布文案、标签和素材...',
    progressTranscribe: '已拿到视频素材，正在识别视频本身文案...',
    progressFinalize: '正在整理可复制、可下载的结果...',
    progressUpload: '正在上传文件并识别语音内容...',
    resultLabel: '结果',
    placeholders: {
      auto: '粘贴作品链接，自动识别并提取文案、视频、图片和Tag',
      video: '粘贴作品链接，提取视频文件',
      image: '粘贴图文作品链接，提取图片、标题、文案和Tag',
      article: '粘贴公众号文章或网页文章链接',
      text: '粘贴作品链接，提取文案、标题和Tag'
    },
    featureEyebrow: '强大功能',
    featureTitle: '不只是复制链接，而是把内容整理成可用素材',
    stepsEyebrow: '使用步骤',
    stepsTitle: '三步完成视频和文案提取',
    faqTitle: '常见问题解答',
    faqSubtitle: '关于 CopyPilot 视频文案提取工具的常见问题和详细解答',
    seoEyebrow: '热门工具',
    seoTitle: '按平台和场景快速提取内容',
    footerDesc: '支持50+平台的视频、图文、文章和文案提取工具。',
    core: '核心功能',
    hot: '热门工具',
    info: '基础信息'
  };
  const en = {
    nav: ['Home', 'Video', 'Text', 'Images', 'Articles'],
    login: 'Sign in',
    heroBadge: 'Free online content extractor',
    heroTitle: 'Extract videos, captions, images, and articles from 50+ platforms',
    heroSubtitle: 'Paste a link to extract video captions, MP3/audio, downloadable videos, images, and post metadata. Supports Douyin, Xiaohongshu, TikTok, and more.',
    linkText: 'Extract from link',
    localText: 'Upload audio/video',
    start: 'Extract',
    loading: 'Extracting...',
    paste: 'Paste',
    clear: 'Clear',
    progressTitle: 'Processing, please wait...',
    progressDetect: 'Detecting link type and platform...',
    progressExtract: 'Extracting title, caption, tags, and media...',
    progressTranscribe: 'Video found. Transcribing the spoken content...',
    progressFinalize: 'Preparing copyable and downloadable results...',
    progressUpload: 'Uploading the file and recognizing speech...',
    resultLabel: 'Result',
    placeholders: {
      auto: 'Paste a post link to auto extract captions, videos, images, and tags',
      video: 'Paste a post link to extract video files',
      image: 'Paste an image post link to extract images, title, caption, and tags',
      article: 'Paste a WeChat article or web article link',
      text: 'Paste a post link to extract caption, title, and tags'
    },
    featureEyebrow: 'Features',
    featureTitle: 'Turn links into reusable content assets',
    stepsEyebrow: 'How it works',
    stepsTitle: 'Extract content in three steps',
    faqTitle: 'Frequently Asked Questions',
    faqSubtitle: 'Common questions and detailed answers about CopyPilot content extraction tools',
    seoEyebrow: 'Popular tools',
    seoTitle: 'Find tools by platform and workflow',
    footerDesc: 'A video, image, article, and caption extraction tool for 50+ platforms.',
    core: 'Core',
    hot: 'Popular tools',
    info: 'Info'
  };
  const base = lang.value === 'en' ? en : zh;
  return mergeUiText(base, siteContent.value?.[lang.value]?.uiText);
});

function mergeUiText(base, override) {
  if (!override) return base;
  return {
    ...base,
    ...override,
    nav: Array.isArray(override.nav) && override.nav.length ? override.nav : base.nav,
    placeholders: {
      ...base.placeholders,
      ...(override.placeholders || {})
    }
  };
}

const toolPage = computed(() => {
  const page = pageMap[currentPath.value] || seoToolPage(currentPath.value);
  if (!page) return page;
  const localizedPage = lang.value === 'en' ? { ...page, ...(enPageMap[currentPath.value] || {}) } : page;
  const editablePage = siteContent.value?.[lang.value]?.toolPages?.[currentPath.value] || {};
  return {
    ...localizedPage,
    ...editablePage,
    type: page.type,
    theme: page.theme
  };
});
const activeSeoPage = computed(() => seoPageByPath[currentPath.value] || null);
const isSharedListPage = computed(() => currentPath.value === '/shared');
const isProfitPage = computed(() => currentPath.value === '/profit');
const sharedVideoId = computed(() => {
  const match = currentPath.value.match(/^\/share\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
});
const isShareDetailPage = computed(() => Boolean(sharedVideoId.value));
const isSharedPage = computed(() => isSharedListPage.value || isShareDetailPage.value);
const currentShareUrl = computed(() => `${window.location.origin}${currentPath.value}`);
const isHome = computed(() => !toolPage.value && !isSharedPage.value && !isProfitPage.value);
const pageTheme = computed(() => toolPage.value?.theme || 'blue');
const isLegalPage = computed(() => toolPage.value?.type === 'legal');
const isFilePage = computed(() => toolPage.value?.type === 'media-file' || (toolPage.value?.type === 'text' && textMode.value === 'file'));
const fileAccept = computed(() => (fileMode.value === 'audio' ? 'audio/*' : 'video/*'));
const fileLabel = computed(() => (fileMode.value === 'audio' ? '选择音频文件' : '选择视频文件'));
const isLinkInputPage = computed(() => !isFilePage.value);
const authButtonText = computed(() => currentUser.value ? currentUser.value.email.split('@')[0] : uiText.value.login);
const isAdmin = computed(() => Boolean(currentUser.value?.isAdmin || currentUser.value?.plan === 'admin'));
const currentPlanLabel = computed(() => formatPlanName(currentUser.value?.plan));
const unreadSharedCount = computed(() => sharedVideos.value.filter((item) => item?.id && !viewedSharedIds.value.includes(item.id)).length);
const profitCurrentPrice = computed(() => calcAveragePriceFromGmv(profitForm.value.currentGrossGmv, profitForm.value.orderCount));
const profitAdjustedPrice = computed(() => calcAveragePriceFromGmv(profitForm.value.adjustedGrossGmv, profitForm.value.orderCount));
const profitCurrent = computed(() => runProfitScenario(profitCurrentPrice.value));
const profitAdjusted = computed(() => runProfitScenario(profitAdjustedPrice.value, profitForm.value.adjustedRoi));
const currentBreakEvenRoi = computed(() => getProfitValue(profitCurrent.value, 'breakEvenRoi'));
const adjustedBreakEvenRoi = computed(() => getProfitValue(profitAdjusted.value, 'breakEvenRoi'));
const currentCollectionBreakEvenRoi = computed(() => getProfitValue(profitCurrent.value, 'collectionBreakEvenRoi'));
const adjustedCollectionBreakEvenRoi = computed(() => getProfitValue(profitAdjusted.value, 'collectionBreakEvenRoi'));
const activeProfitFormulaMeta = computed(() => profitFormulaMeta.find((item) => item.key === profitFormulaEditorKey.value) || null);
const totalReturnRatePercent = computed(() => {
  const preShip = Number(profitForm.value.preShipReturnRatePercent) || 0;
  const postShip = Number(profitForm.value.postShipReturnRatePercent) || 0;
  return clampNumber(preShip + postShip, 0, 99.999);
});
const profitDelta = computed(() => ({
  price: profitAdjustedPrice.value - profitCurrentPrice.value,
  roi: (Number(profitForm.value.adjustedRoi) || 0) - (Number(profitForm.value.roi) || 0),
  profit: getProfitValue(profitAdjusted.value, 'profit') - getProfitValue(profitCurrent.value, 'profit'),
  profitPerOrder: getProfitValue(profitAdjusted.value, 'profitPerOrder') - getProfitValue(profitCurrent.value, 'profitPerOrder'),
  profitPerSettledOrder: getProfitValue(profitAdjusted.value, 'profitPerSettledOrder') - getProfitValue(profitCurrent.value, 'profitPerSettledOrder')
}));
const profitInputWarnings = computed(() => {
  const warnings = [];
  const cost = Number(profitForm.value.productCost) || 0;
  const currentPrice = profitCurrentPrice.value;
  const adjustedPrice = profitAdjustedPrice.value;
  if (currentPrice > 0 && cost > 0 && currentPrice < cost) {
    warnings.push(`当前客单价 ${formatMoney(currentPrice)} 低于单均货款成本 ${formatMoney(cost)}，请检查“当前销售GMV”和“下单量”是否同一口径。`);
  }
  if (adjustedPrice > 0 && cost > 0 && adjustedPrice < cost) {
    warnings.push(`调整后客单价 ${formatMoney(adjustedPrice)} 低于单均货款成本 ${formatMoney(cost)}，请检查“调整后销售GMV”和“下单量”是否同一口径。`);
  }
  return warnings;
});

function seoToolPage(path) {
  const page = seoPageByPath[path];
  if (!page || path === '/') return null;
  return {
    badge: page.badge,
    title: page.h1,
    subtitle: page.description,
    seoTitle: page.title,
    type: page.toolType,
    theme: page.theme
  };
}

const articleTemplates = computed(() => lang.value === 'en'
  ? [
      { id: 'clean', name: 'Clean' },
      { id: 'knowledge', name: 'Knowledge' },
      { id: 'marketing', name: 'Marketing' }
    ]
  : [
      { id: 'clean', name: '极简白底' },
      { id: 'knowledge', name: '干货教程' },
      { id: 'marketing', name: '营销种草' }
    ]);

const defaultMembershipPlans = [
  {
    id: 'monthly',
    name: '月会员',
    price: '¥29/月',
    note: '适合日常短视频、图文和文章提取',
    features: ['常用平台内容提取', '视频文案识别', '图片和视频素材下载']
  },
  {
    id: 'yearly',
    name: '年会员',
    price: '¥299/年',
    tag: '推荐',
    note: '适合长期做内容的账号和运营人员',
    features: ['全年会员权益', '更高使用额度', '适合高频内容整理']
  },
  {
    id: 'lifetime',
    name: '永久会员',
    price: '¥699',
    note: '适合长期使用 CopyPilot 的创作者',
    features: ['长期会员权益', '优先支持新功能', '适合工作室长期使用']
  }
];
const membershipPlans = ref(defaultMembershipPlans);

function formatPlanName(plan) {
  const map = {
    free: '免费版',
    monthly: '月会员',
    pro: '月会员',
    yearly: '年会员',
    lifetime: '永久会员',
    admin: '管理员'
  };
  return map[plan] || '免费版';
}

const featureIcons = [BadgeCheck, Captions, Image, Sparkles];

const featureCards = computed(() => {
  const editableCards = siteContent.value?.[lang.value]?.featureCards;
  if (Array.isArray(editableCards) && editableCards.length) {
    return editableCards.map((item, index) => ({
      title: item.title,
      text: item.text,
      icon: featureIcons[index % featureIcons.length]
    }));
  }
  return lang.value === 'en'
    ? [
      { title: '50+ platforms', text: 'Supports Douyin, Xiaohongshu, TikTok, Kuaishou, and more content platforms.', icon: BadgeCheck },
      { title: 'Caption extraction', text: 'Collect titles, captions, author details, and media links automatically.', icon: Captions },
      { title: 'Image extraction', text: 'Useful for image posts, ecommerce assets, and content breakdowns.', icon: Image },
      { title: 'Smart routing', text: 'Detects link types and routes them to the right extraction workflow.', icon: Sparkles }
    ]
    : [
      { title: '50+平台支持', text: '覆盖抖音、小红书、TikTok、快手等主流内容平台。', icon: BadgeCheck },
      { title: '视频文案提取', text: '自动整理视频标题、正文、作者信息和素材链接。', icon: Captions },
      { title: '图片内容提取', text: '适合图文笔记、电商素材和内容拆解。', icon: Image },
      { title: 'AI智能识别', text: '自动识别链接类型，减少手动选择和复制整理。', icon: Sparkles }
    ];
});

const steps = computed(() => {
  const editableSteps = siteContent.value?.[lang.value]?.steps;
  if (Array.isArray(editableSteps) && editableSteps.length) return editableSteps;
  return lang.value === 'en'
    ? [
      ['Copy a link', 'Copy a shared post or article link from a supported platform.'],
      ['Paste and extract', 'Paste the link into CopyPilot and start extraction.'],
      ['Use the result', 'Copy captions, download images, preview videos, or reuse article layouts.']
    ]
    : [
      ['复制链接', '从抖音、小红书等平台复制作品分享链接。'],
      ['粘贴提取', '把链接粘贴到输入框，点击开始提取。'],
      ['复制结果', '获取文案、图片或视频素材链接，继续整理使用。']
    ];
});

const faqs = computed(() => {
  const editableFaqs = siteContent.value?.[lang.value]?.faqs;
  if (Array.isArray(editableFaqs) && editableFaqs.length) return editableFaqs;
  return lang.value === 'en'
    ? [
      ['Is CopyPilot completely free? Are there usage limits?', 'CopyPilot is currently free for core extraction workflows. You can extract captions, videos, images, audio, and article content directly from the browser.'],
      ['Which platforms are supported? Are overseas platforms supported?', 'CopyPilot targets 50+ mainstream platforms, including Douyin, Xiaohongshu, Kuaishou, Bilibili, Weibo, WeChat articles, TikTok, YouTube, Instagram, Lemon8, and more. Publicly accessible links usually work best.'],
      ['How accurate is video speech-to-text? Which languages are supported?', 'Speech recognition works best when the audio is clear. Chinese, English, Japanese, Korean, and other common languages are supported, while heavy background noise, music, or overlapping voices may reduce accuracy.'],
      ['How long does extraction take? Are there file size limits?', 'Titles, captions, images, and basic media links usually finish in 3-10 seconds. Speech-to-text requires server processing and depends on the media length. The free version currently supports media within 5 minutes.'],
      ['Are downloaded videos watermarked? Will quality be compressed?', 'When the source provides an original media link, CopyPilot keeps the source quality as much as possible and does not recompress files. Actual watermark and quality depend on what the platform returns.'],
      ['How does batch download work? How many files are supported?', 'On result pages, media sections can provide download actions for videos or images. Batch packaging can be added for suitable result types and is best used for image-heavy posts.'],
      ['Can extracted content be used commercially? Are there copyright issues?', 'CopyPilot is a technical tool. Copyright belongs to the original creators or rights holders. Please follow platform rules and copyright law, mark sources for reference use, and obtain authorization before commercial use.'],
      ['Why do some videos fail to extract?', 'Common reasons include deleted content, private posts, expired links, platform restrictions, temporary interface changes, unsupported formats, or network issues. Check whether the link is correct and publicly accessible, then retry later.'],
      ['Is CopyPilot safe? Will my information be exposed?', 'CopyPilot uses HTTPS. Extraction is handled for the requested task only, and public pages do not require account information. Avoid submitting private or sensitive links.'],
      ['Can I use it on mobile and desktop?', 'Yes. CopyPilot is responsive and works in modern browsers on phones, tablets, Windows, and Mac. No app download is required.']
    ]
    : [
      ['CopyPilot 完全免费吗？有使用次数限制吗？', 'CopyPilot 当前公开版本免费使用，可以直接提取视频文案、下载视频、提取图片、音频和文章内容。核心工具打开页面即可使用。'],
      ['支持哪些视频平台？是否支持海外平台？', 'CopyPilot 支持 50+ 主流内容平台，包括抖音、小红书、快手、B站、微博、公众号文章、TikTok、YouTube、Instagram、Lemon8 等。只要是公开可访问的作品链接，通常都可以尝试提取。'],
      ['视频文案识别的准确率如何？支持哪些语言？', '音频清晰时，语音转文字效果会更好。当前支持中文、英语、日语、韩语等常见语言。如果视频声音较小、背景噪音较大、多人同时说话或音乐较重，识别准确度可能会受到影响。'],
      ['提取视频文案需要多长时间？有大小限制吗？', '标题、正文、图片和基础媒体链接通常 3-10 秒内完成。视频文案提取，也就是语音转文字，需要服务器处理，耗时会根据视频长度变化。免费版目前支持 5 分钟以内的音视频。'],
      ['下载的视频有水印吗？画质会被压缩吗？', '如果平台接口返回原始媒体链接，CopyPilot 会尽量保留源文件质量，不会主动进行二次压缩。是否带水印、清晰度高低，取决于平台实际返回的媒体资源。'],
      ['批量下载功能如何使用？最多支持多少个文件？', '在提取结果页面，视频或图片区域会显示对应的打开、下载或复制按钮。对于图片较多的图文内容，后续也可以扩展为 ZIP 打包下载，更适合素材整理和批量保存。'],
      ['提取的内容可以商用吗？有版权问题吗？', 'CopyPilot 只提供技术工具服务，提取内容的版权归原作者或权利方所有。使用提取内容时，请遵守相关平台规则和版权法律。学习参考、二次创作建议注明来源，商业使用前请先获得授权。'],
      ['为什么有些视频无法提取或提取失败？', '常见原因包括作品已删除、内容设为私密、链接过期、平台限制、接口临时变化、格式暂不支持或网络连接异常。遇到这种情况，可以检查链接是否正确、作品是否公开可见，或稍后重试。'],
      ['使用 CopyPilot 安全吗？会泄露我的信息吗？', 'CopyPilot 使用 HTTPS 加密传输，公开工具页面不需要提交个人资料。提取请求只用于完成当前任务。请不要提交私密、敏感或没有授权的链接内容。'],
      ['手机和电脑端都可以使用吗？', '可以。CopyPilot 采用响应式设计，支持手机、平板和电脑浏览器。无论使用 iOS、Android、Windows 还是 Mac，都可以直接在浏览器中打开使用，无需下载 App。']
    ];
});

const seoToolGroups = computed(() => lang.value === 'en'
  ? [
      { title: 'Video platforms', links: [
        ['/douyin-video-download', 'Douyin video downloader'],
        ['/tiktok-video-download', 'TikTok video downloader'],
        ['/kuaishou-video-download', 'Kuaishou video downloader'],
        ['/bilibili-video-download', 'Bilibili video downloader'],
        ['/youtube-video-download', 'YouTube video downloader'],
        ['/weibo-video-download', 'Weibo video downloader'],
        ['/instagram-video-download', 'Instagram video downloader']
      ] },
      { title: 'Image platforms', links: [
        ['/xiaohongshu-image-download', 'Xiaohongshu image extractor'],
        ['/instagram-image-download', 'Instagram image extractor'],
        ['/lemon8-image-download', 'Lemon8 image extractor'],
        ['/weibo-image-download', 'Weibo image extractor']
      ] },
      { title: 'Article platforms', links: [
        ['/wechat-article', 'WeChat article extractor'],
        ['/article-studio', 'WeChat rewrite studio'],
        ['/zhihu-article', 'Zhihu article extractor'],
        ['/web-article', 'Web article extractor']
      ] },
      { title: 'Speech to text', links: [
        ['/video-to-text', 'Video to text'],
        ['/audio-to-text', 'Audio to text'],
        ['/local-video-to-text', 'Local video transcript'],
        ['/local-audio-to-text', 'Local audio transcript']
      ] }
    ]
  : [
      { title: '视频平台', links: [
        ['/douyin-video-download', '抖音视频提取'],
        ['/tiktok-video-download', 'TikTok 视频提取'],
        ['/kuaishou-video-download', '快手视频提取'],
        ['/bilibili-video-download', 'B站视频提取'],
        ['/youtube-video-download', 'YouTube 视频提取'],
        ['/weibo-video-download', '微博视频提取'],
        ['/instagram-video-download', 'Instagram 视频提取']
      ] },
      { title: '图文平台', links: [
        ['/xiaohongshu-image-download', '小红书图文提取'],
        ['/instagram-image-download', 'Instagram 图文提取'],
        ['/lemon8-image-download', 'Lemon8 图文提取'],
        ['/weibo-image-download', '微博图文提取']
      ] },
      { title: '文章平台', links: [
        ['/wechat-article', '公众号文章提取'],
        ['/article-studio', '公众号二创排版'],
        ['/zhihu-article', '知乎文章提取'],
        ['/web-article', '网页文章提取']
      ] },
      { title: '转文字工具', links: [
        ['/video-to-text', '视频转文字'],
        ['/audio-to-text', '音频转文字'],
        ['/local-video-to-text', '本地视频提取文案'],
        ['/local-audio-to-text', '本地音频提取文案']
      ] }
    ]);

const seoToolLinks = computed(() => seoToolGroups.value.flatMap((group) => group.links));

const legalLinks = computed(() => lang.value === 'en'
  ? [
      ['/privacy', 'Privacy'],
      ['/terms', 'Terms'],
      ['/copyright', 'Copyright'],
      ['/contact', 'Contact']
    ]
  : [
      ['/privacy', '隐私政策'],
      ['/terms', '服务条款'],
      ['/copyright', '版权说明'],
      ['/contact', '联系我们']
    ]);

const legalContent = computed(() => {
  const map = {
    '/privacy': [
      ['我们会处理哪些信息', '你提交的作品链接、上传的音视频文件、提取结果和基础访问日志，用于完成提取、排查错误和保障服务稳定。'],
      ['文件如何处理', '上传文件仅用于生成文字稿。正式上线后会设置自动清理策略，避免长期保存非必要素材。'],
      ['第三方服务', '部分提取和识别能力需要调用第三方服务完成。我们不会把你的内容用于公开展示。']
    ],
    '/terms': [
      ['合理使用', '请只提取你有权处理的内容，不要用于侵犯版权、隐私或平台规则的用途。'],
      ['服务限制', '私密作品、删除作品、过期链接、平台限制或超大文件可能导致提取失败。'],
      ['免费使用', '当前公开版本打开页面即可使用基础提取功能。']
    ],
    '/copyright': [
      ['内容归属', 'CopyPilot 不拥有你提取的原始素材版权，也不会授予你对第三方内容的商业使用权。'],
      ['版权投诉', '如果你认为某些使用行为侵犯了你的权益，可以联系我们处理。'],
      ['使用建议', '下载或复用素材前，请确认原作者授权、平台规则和当地法律要求。']
    ],
    '/contact': [
      ['产品反馈', '如果你希望支持更多平台、批量下载或更好的转写效果，可以把需求发给我们。'],
      ['问题反馈', '反馈时请附上页面路径、失败链接类型和大致时间，方便我们定位。'],
      ['联系邮箱', 'support@copypilot.app']
    ]
  };
  return map[currentPath.value] || [];
});

const resultTitle = computed(() => {
  const detail = primaryDetail.value;
  const explicitTitle =
    result.value?.title ||
    detail?.title ||
    detail?.msg_title ||
    detail?.appmsg_title ||
    detail?.article_title ||
    result.value?.note?.title ||
    result.value?.aweme_detail?.desc ||
    result.value?.itemInfo?.itemStruct?.desc ||
    result.value?.aweme_detail?.share_info?.share_title ||
    result.value?.itemInfo?.itemStruct?.share_info?.share_title ||
    '';

  return cleanTitle(explicitTitle) || makeTitleFromDescription(publishedText.value || resultText.value);
});

const resultHeading = computed(() => {
  if (!result.value) return '提取结果';
  if (isShareDetailPage.value) return '共享视频详情';
  if (isHome.value) return '智能提取结果';
  if (toolPage.value?.type === 'text') return '文案提取结果';
  if (toolPage.value?.type === 'video') return '视频提取结果';
  if (toolPage.value?.type === 'image') return '图文提取结果';
  if (toolPage.value?.type === 'article') return '文章提取结果';
  return `${toolPage.value?.badge || '内容'}提取结果`;
});

const resultText = computed(() => {
  const data = result.value;
  const detail = primaryDetail.value;
  if (!data) return '';

  if (toolPage.value?.type === 'article') {
    return (
      readArticleText(detail) ||
      stripHtml(detail?.content_html || detail?.html || detail?.article_content || detail?.digest) ||
      stripHtml(data.full_text || data.article_content || data.content_html || data.html || data.text || '') ||
      ''
    );
  }

  return (
    data.transcript ||
    data.text ||
    readArticleText(detail) ||
    stripHtml(detail?.content_html || detail?.html || detail?.article_content || detail?.digest) ||
    detail?.description ||
    detail?.desc ||
    detail?.displayTitle ||
    data.description ||
    data.desc ||
    data.caption ||
    data.aweme_detail?.desc ||
    data.itemInfo?.itemStruct?.desc ||
    data.note?.desc ||
    ''
  );
});

const publishedText = computed(() => {
  const data = result.value;
  const detail = primaryDetail.value;
  if (!data) return '';
  return (
    data.publishedText ||
    detail?.description ||
    detail?.desc ||
    data.description ||
    data.desc ||
    data.caption ||
    data.aweme_detail?.desc ||
    data.itemInfo?.itemStruct?.desc ||
    data.note?.desc ||
    ''
  );
});

const tags = computed(() => {
  const detail = primaryDetail.value || {};
  const data = result.value || {};
  const detailTags = [
    ...toArray(detail.tagList),
    ...toArray(detail.tags),
    ...toArray(detail.hashtags),
    ...toArray(data.tags),
    ...toArray(data.hashtags),
    ...toArray(data.keywords)
  ]
    .map(readTagName)
    .filter(Boolean)
    .map((tag) => `#${cleanTopicName(tag)}`)
    .filter(Boolean);
  const text = `${publishedText.value} ${resultText.value}`.trim();
  const textTags = text ? [...text.matchAll(/#[^\s#，,。；;]+/g)].map((match) => `#${cleanTopicName(match[0])}`) : [];
  return [...new Set([...detailTags, ...textTags])];
});

function cleanTitle(value) {
  const text = String(value || '').trim();
  if (!text || text === '未命名视频') return '';
  return text
    .split(/[#\n\r]/)[0]
    .replace(/^[\s"“”'‘’]+|[\s"“”'‘’]+$/g, '')
    .replace(/[，,。；;！!？?]$/, '')
    .slice(0, 80);
}

function makeTitleFromDescription(value) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const withoutTags = text
    .replace(/#[^\s#，,。；;！!？?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const candidate = withoutTags || text.replace(/^#+/, '');
  return String(candidate)
    .replace(/^[\s"“”'‘’]+|[\s"“”'‘’]+$/g, '')
    .replace(/[，,。；;！!？?]$/, '')
    .slice(0, 80);
}

const videoLinks = computed(() => {
  const data = result.value;
  if (!data) return [];
  const detail = primaryDetail.value || data.aweme_detail || data.itemInfo?.itemStruct || data.note || data;
  const video = detail.video || data.video || {};
  const links = [];

  if (video.play_addr?.url_list?.length) links.push(...video.play_addr.url_list);
  if (video.download_addr?.url_list?.length) links.push(...video.download_addr.url_list);
  if (detail.video_url) links.push(detail.video_url);
  if (data.video_url) links.push(data.video_url);
  if (data.videoUrl) links.push(data.videoUrl);
  if (data.originVideoUrl) links.push(data.originVideoUrl);
  if (data.videos?.items?.length) {
    const sortedVideos = [...data.videos.items].sort((a, b) => Number(b.hasAudio) - Number(a.hasAudio));
    links.push(...sortedVideos.map((item) => item.url));
  }
  links.push(...findVideoUrlsDeep(detail));
  return [...new Set(links.map(normalizeMediaUrl).filter(Boolean))].slice(0, 8);
});

const previewVideoUrl = computed(() => {
  if (!videoLinks.value.length) return '';
  return `/api/video-proxy?url=${encodeURIComponent(videoLinks.value[0])}`;
});

const imageLinks = computed(() => {
  const data = result.value;
  if (!data) return [];
  const detail = primaryDetail.value || data.aweme_detail || data.itemInfo?.itemStruct || data.note || data;
  const images = [
    ...toArray(detail.imageList),
    ...toArray(detail.images),
    ...toArray(detail.content?.article?.images),
    ...toArray(detail.image_post_info?.images),
    ...toArray(data.images)
  ];
  const thumbnails = [
    ...toArray(detail.thumbnails),
    ...toArray(data.thumbnails),
    ...toArray(detail.thumbnail),
    ...toArray(data.thumbnail)
  ];
  const links = [];

  if (detail.cover?.url_list?.length) links.push(detail.cover.url_list[0]);
  if (detail.cover) links.push(pickImageUrl(detail.cover));
  if (detail.cover_url) links.push(detail.cover_url);
  if (data.cover) links.push(data.cover);
  if (detail.msg_cdn_url) links.push(detail.msg_cdn_url);
  for (const image of images) {
    const bestImage = pickImageUrl(image);
    if (bestImage) links.push(bestImage);
  }
  for (const image of thumbnails) {
    const bestImage = pickImageUrl(image);
    if (bestImage) links.push(bestImage);
  }
  links.push(...findImageUrlsDeep(detail.content));
  links.push(...extractImageUrls(articleHtml.value));
  return [...new Set(links.map(normalizeMediaUrl).filter(Boolean))].slice(0, 8);
});

const resultCover = computed(() => {
  const data = result.value || {};
  const detail = primaryDetail.value || data.aweme_detail || data.itemInfo?.itemStruct || data.note || data;
  const candidates = [
    data.cover,
    data.coverUrl,
    data.cover_url,
    data.thumbnail,
    data.thumbnailUrl,
    data.poster,
    detail.cover,
    detail.coverUrl,
    detail.cover_url,
    detail.thumbnail,
    detail.thumbnailUrl,
    detail.poster,
    detail.video?.cover,
    detail.video?.origin_cover,
    detail.video?.dynamic_cover,
    imageLinks.value[0],
    findImageUrlsDeep(data).find((link) => !/avatar|headimg|head_img|profile/i.test(link))
  ];
  for (const candidate of candidates) {
    const url = normalizeMediaUrl(pickImageUrl(candidate) || candidate);
    if (url) return url;
  }
  return '';
});

const resultAuthor = computed(() => {
  const data = result.value || {};
  const detail = primaryDetail.value || data.aweme_detail || data.itemInfo?.itemStruct || data.note || data;
  return (
    data.author ||
    data.authorInfo?.nickname ||
    detail.author?.nickname ||
    detail.authorInfo?.nickname ||
    detail.user?.nickname ||
    detail.user?.userName ||
    data.nickname ||
    ''
  );
});

const primaryDetail = computed(() => findPrimaryDetail(result.value));
const articleHtml = computed(() => {
  const detail = primaryDetail.value || {};
  return detail.content_html || detail.html || detail.article_content || result.value?.html || '';
});

const hasResultContent = computed(() => result.value || videoLinks.value.length || imageLinks.value.length);
const shouldShowVideoResult = computed(() => videoLinks.value.length && (isShareDetailPage.value || isHome.value || ['video', 'text'].includes(toolPage.value?.type)));
const shouldShowImageResult = computed(() => {
  if (result.value?.platform === 'wechat_channels') return false;
  return imageLinks.value.length && (isHome.value || ['image', 'article'].includes(toolPage.value?.type));
});
const hasVideoTranscript = computed(() => Boolean(result.value?.transcript && resultText.value));
const shouldShowVideoTextUnderPreview = computed(() => {
  if (!shouldShowVideoResult.value || !hasVideoTranscript.value) return false;
  return isShareDetailPage.value || isHome.value || toolPage.value?.type === 'video' || toolPage.value?.type === 'text';
});
const transcriptStageItems = computed(() => {
  const order = ['source', 'download', 'extract_audio', 'asr', 'result'];
  const labels = {
    source: '解析视频',
    download: '下载视频',
    extract_audio: '提取音频',
    asr: '千问转写',
    result: '整理结果'
  };
  const current = normalizeTranscriptStage(transcriptProgress.value.stage);
  const currentIndex = Math.max(0, order.indexOf(current));
  return order.map((stage, index) => ({
    stage,
    label: labels[stage],
    active: stage === current,
    done: current === 'result' ? index <= currentIndex : index < currentIndex
  }));
});
const shouldShowMainTextBlock = computed(() => {
  if (hasVideoTranscript.value && (isShareDetailPage.value || isHome.value || toolPage.value?.type === 'video')) return false;
  return true;
});
const shouldShowPublishedText = computed(() => {
  if (!publishedText.value) return false;
  if (!isHome.value && !(toolPage.value?.type === 'text' && textMode.value === 'link')) return false;
  return normalizeCompareText(publishedText.value) !== normalizeCompareText(resultText.value);
});
const copyBlockTitle = computed(() => {
  if (result.value?.transcriptSkipped) return '平台发布文案';
  if (isHome.value && result.value?.transcript) return '视频识别文案';
  if (toolPage.value?.type === 'video' && result.value?.transcript) return '视频逐字稿';
  if (isHome.value) return '作品文案';
  if (toolPage.value?.type === 'text') {
    if (textMode.value === 'file') return '视频/音频识别文案';
    return result.value?.transcript ? '视频识别文案' : '平台发布文案';
  }
  if (toolPage.value?.type === 'image') return '图文正文';
  if (toolPage.value?.type === 'article') return '文章正文';
  return '作品文案';
});

const articleBlocks = computed(() => {
  if (toolPage.value?.type !== 'article' || !result.value) return [];

  const htmlBlocks = parseArticleHtmlBlocks(articleHtml.value);
  if (htmlBlocks.length) return htmlBlocks;

  const paragraphs = splitArticleParagraphs(resultText.value).map((text) => ({ type: 'text', text }));
  const images = imageLinks.value.map((src, index) => ({ type: 'image', src, index }));
  if (!paragraphs.length) return images;
  if (!images.length) return paragraphs;

  const blocks = [];
  const interval = Math.max(1, Math.ceil(paragraphs.length / (images.length + 1)));
  let imageIndex = 0;

  paragraphs.forEach((paragraph, index) => {
    blocks.push(paragraph);
    if ((index + 1) % interval === 0 && imageIndex < images.length) {
      blocks.push(images[imageIndex]);
      imageIndex += 1;
    }
  });

  while (imageIndex < images.length) {
    blocks.push(images[imageIndex]);
    imageIndex += 1;
  }

  return blocks;
});

const articleCopyHtml = computed(() => {
  if (articleDraftHtml.value) return articleDraftHtml.value;
  return buildWechatArticleHtml(articleBlocks.value, {
    title: resultTitle.value,
    template: articleTemplate.value
  });
});

function buildWechatArticleHtml(blocks, { title = '', template = 'clean' } = {}) {
  if (!blocks?.length && !title) return '';
  const style = getWechatTemplateStyle(template);
  const safeTitle = escapeHtml(title || '');
  const body = (blocks || []).map((block) => {
    if (block.type === 'heading') {
      return `<h2 style="${style.heading}">${escapeHtml(block.text)}</h2>`;
    }
    if (block.type === 'image') {
      return `<p style="${style.imageWrap}"><img src="${escapeHtml(block.src)}" style="max-width:100%;height:auto;border-radius:${style.imageRadius};" /></p>`;
    }
    return `<p style="${style.paragraph}">${escapeHtml(block.text).replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  return [
    `<section style="${style.section}">`,
    safeTitle ? `<h1 style="${style.title}">${safeTitle}</h1>` : '',
    body,
    '</section>'
  ].filter(Boolean).join('\n');
}

function getWechatTemplateStyle(template) {
  const base = {
    section: 'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#111827;background:#ffffff;',
    title: 'font-size:22px;line-height:1.5;margin:0 0 22px;font-weight:800;color:#111827;',
    heading: 'font-size:18px;line-height:1.6;margin:28px 0 12px;font-weight:800;color:#111827;',
    paragraph: 'font-size:16px;line-height:1.95;margin:14px 0;color:#1f2937;',
    imageWrap: 'margin:20px 0;text-align:center;',
    imageRadius: '8px'
  };
  if (template === 'knowledge') {
    return {
      section: 'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#162033;background:#ffffff;',
      title: 'font-size:22px;line-height:1.5;margin:0 0 20px;font-weight:800;color:#0f172a;border-left:5px solid #2563eb;padding-left:12px;',
      heading: 'font-size:18px;line-height:1.6;margin:30px 0 12px;font-weight:800;color:#1d4ed8;background:#eff6ff;border-radius:8px;padding:8px 12px;',
      paragraph: 'font-size:16px;line-height:1.95;margin:14px 0;color:#1f2937;',
      imageWrap: 'margin:22px 0;text-align:center;',
      imageRadius: '8px'
    };
  }
  if (template === 'marketing') {
    return {
      section: 'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#201018;background:#ffffff;',
      title: 'font-size:23px;line-height:1.45;margin:0 0 22px;font-weight:900;color:#be185d;',
      heading: 'font-size:18px;line-height:1.6;margin:28px 0 12px;font-weight:800;color:#be185d;border-bottom:2px solid #fbcfe8;padding-bottom:6px;',
      paragraph: 'font-size:16px;line-height:1.95;margin:14px 0;color:#3f2430;',
      imageWrap: 'margin:22px 0;text-align:center;',
      imageRadius: '10px'
    };
  }
  return base;
}

function findPrimaryDetail(data) {
  if (!data) return null;
  return (
    data.noteCard ||
    data.note ||
    data.article ||
    data.mp_article ||
    data.aweme_detail ||
    data.itemInfo?.itemStruct ||
    data.data?.items?.[0]?.noteCard ||
    data.items?.[0]?.noteCard ||
    data.data?.article ||
    data.data?.mp_article ||
    data.data?.noteCard ||
    data.data?.note ||
    data.data ||
    data
  );
}

function normalizeMediaUrl(link) {
  const value = String(link || '').trim();
  if (!value) return '';
  if (!/^https?:\/\//i.test(value)) return '';
  if (value.startsWith('http://')) return `https://${value.slice(7)}`;
  return value;
}

function normalizeCompareText(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function toArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.list)) return value.list;
    if (Array.isArray(value.data)) return value.data;
  }
  return [value];
}

function cleanTopicName(value) {
  return String(value || '')
    .replace(/^#/, '')
    .replace(/\[话题\]$/g, '')
    .trim();
}

function readTagName(tag) {
  if (!tag) return '';
  if (typeof tag === 'string') return tag;
  return tag.name || tag.title || tag.text || tag.tag_name || tag.keyword || '';
}

function pickImageUrl(image) {
  if (!image) return '';
  if (typeof image === 'string') return image;
  if (image.urlDefault) return image.urlDefault;
  if (image.src) return image.src;
  if (image.data_src) return image.data_src;
  if (image.dataSrc) return image.dataSrc;
  const defaultInfo = image.infoList?.find((item) => item.imageScene === 'WB_DFT');
  if (defaultInfo?.url) return defaultInfo.url;
  if (image.url) return image.url;
  if (image.url_list?.length) return image.url_list[0];
  if (image.display_image?.url_list?.length) return image.display_image.url_list[0];
  if (image.urlPre) return image.urlPre;
  return image.infoList?.[0]?.url || '';
}

function stripHtml(value) {
  if (!value || typeof value !== 'string') return '';
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function readArticleText(detail) {
  const content = detail?.content;
  if (!content) return '';
  if (typeof content === 'string') return stripHtml(content);

  const article = content.article || {};
  const candidates = [];

  candidates.push(readTextLike(article.full_text));
  candidates.push(readTextLike(article.summary));

  const sectionText = Array.isArray(article.sections)
    ? article.sections
        .map((section) => [section.title, section.text].filter(Boolean).join('\n'))
        .filter(Boolean)
        .join('\n\n')
    : '';
  candidates.push(sectionText);

  const rawText = Array.isArray(content.raw_content)
    ? content.raw_content.map(readTextLike).filter(Boolean).join('\n\n')
    : '';
  candidates.push(rawText);
  candidates.push(readTextLike(content.full_text));
  candidates.push(readTextLike(content.text));
  candidates.push(readTextLike(content.summary));
  candidates.push(readTextLike(detail.full_text));
  candidates.push(readTextLike(detail.article_content));

  return candidates
    .map((item) => normalizeArticleText(item))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] || '';
}

function readTextLike(value) {
  if (!value) return '';
  if (typeof value === 'string') return stripHtml(value);
  if (Array.isArray(value)) return value.map(readTextLike).filter(Boolean).join('\n');
  if (typeof value === 'object') return stripHtml(value.text || value.content || value.value || value.title || '');
  return String(value);
}

function extractImageUrls(html) {
  const text = String(html || '');
  const urls = [];
  for (const match of text.matchAll(/<img[^>]+(?:data-src|src)=["']([^"']+)["']/gi)) {
    urls.push(match[1]);
  }
  return urls;
}

function normalizeArticleText(value) {
  return String(value || '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function findImageUrlsDeep(input) {
  const urls = [];
  const seen = new Set();
  const queue = [input];

  while (queue.length) {
    const item = queue.shift();
    if (!item || seen.has(item)) continue;

    if (typeof item === 'string') {
      if (/^https?:\/\/.+\.(?:jpe?g|png|webp|gif)(?:[?#].*)?$/i.test(item) || /mmbiz|qpic|wx_fmt|xhscdn|rednote/i.test(item)) {
        urls.push(item);
      }
      continue;
    }

    if (typeof item !== 'object') continue;
    seen.add(item);

    const picked = pickImageUrl(item);
    if (picked) urls.push(picked);
    for (const value of Object.values(item)) {
      if (value && (typeof value === 'object' || typeof value === 'string')) queue.push(value);
    }
  }

  return urls;
}

function findVideoUrlsDeep(input) {
  const urls = [];
  const seen = new Set();
  const queue = [input];

  while (queue.length) {
    const item = queue.shift();
    if (!item || seen.has(item)) continue;

    if (typeof item === 'string') {
      if (looksLikeVideoUrl(item)) urls.push(item);
      continue;
    }

    if (typeof item !== 'object') continue;
    seen.add(item);

    const directUrl = item.url || item.src || item.video_url || item.play_url || item.download_url;
    const mediaType = `${item.type || ''} ${item.mimeType || ''} ${item.format || ''} ${item.extension || ''}`;
    if (directUrl && /video|mp4|webm|mov|m3u8/i.test(mediaType)) urls.push(directUrl);

    for (const value of Object.values(item)) {
      if (value && (typeof value === 'object' || typeof value === 'string')) queue.push(value);
    }
  }

  return urls;
}

function looksLikeVideoUrl(value) {
  const urlText = String(value || '');
  return /googlevideo\.com\/videoplayback|mime=video|video\/tos|douyinvod|\.mp4(?:[?#]|$)|\.webm(?:[?#]|$)|\.mov(?:[?#]|$)|\.m3u8(?:[?#]|$)/i.test(urlText);
}

function splitArticleParagraphs(text) {
  return String(text || '')
    .split(/\n{2,}|(?<=[。！？!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseArticleHtmlBlocks(html) {
  if (!html || typeof window === 'undefined' || !window.DOMParser) return [];
  const documentHtml = new DOMParser().parseFromString(html, 'text/html');
  const nodes = [...documentHtml.body.querySelectorAll('h1,h2,h3,p,section,blockquote,img')];
  const blocks = [];

  for (const node of nodes) {
    if (node.tagName === 'IMG') {
      const src = normalizeMediaUrl(node.getAttribute('data-src') || node.getAttribute('src') || '');
      if (src) blocks.push({ type: 'image', src, index: blocks.length });
      continue;
    }

    const img = node.querySelector?.('img');
    if (img && node.textContent.trim().length < 8) {
      const src = normalizeMediaUrl(img.getAttribute('data-src') || img.getAttribute('src') || '');
      if (src) blocks.push({ type: 'image', src, index: blocks.length });
      continue;
    }

    const text = stripHtml(node.innerHTML || node.textContent || '');
    if (!text || text.length < 2) continue;
    const type = /^H[1-3]$/.test(node.tagName) ? 'heading' : 'text';
    if (!blocks.some((block) => block.type === type && block.text === text)) {
      blocks.push({ type, text });
    }
  }

  return blocks.slice(0, 120);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trackEvent(eventName, payload = {}) {
  if (typeof window === 'undefined') return;
  const body = JSON.stringify({
    eventName,
    path: currentPath.value,
    lang: lang.value,
    toolType: toolPage.value?.type || (isHome.value ? 'home' : 'unknown'),
    ...payload
  });

  try {
    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {});
  } catch {
    // Event tracking must never block the extraction workflow.
  }
}

function detectPlatformFromUrl(value) {
  try {
    const host = new URL(value).hostname.toLowerCase();
    const pathname = new URL(value).pathname.toLowerCase();
    if (host.includes('weixin.qq.com') && pathname.includes('/sph/')) return 'wechat_channels';
    if (host.includes('douyin')) return 'douyin';
    if (host.includes('xiaohongshu') || host.includes('xhslink')) return 'xiaohongshu';
    if (host.includes('tiktok')) return 'tiktok';
    if (host.includes('instagram')) return 'instagram';
    if (host.includes('youtube') || host.includes('youtu.be')) return 'youtube';
    if (host.includes('kuaishou') || host.includes('gifshow')) return 'kuaishou';
    if (host.includes('bilibili') || host.includes('b23.tv')) return 'bilibili';
    if (host.includes('weibo')) return 'weibo';
    if (host.includes('weixin.qq.com')) return 'wechat';
    if (host.includes('zhihu')) return 'zhihu';
    return host.replace(/^www\./, '').split('.')[0] || 'unknown';
  } catch {
    return 'unknown';
  }
}

function durationBucket(seconds) {
  if (!seconds) return 'unknown';
  if (seconds <= 60) return '0-1m';
  if (seconds <= 300) return '1-5m';
  if (seconds <= 600) return '5-10m';
  return '10m+';
}

function getResultDurationSeconds(data) {
  const detail = findPrimaryDetail(data) || data?.aweme_detail || data?.itemInfo?.itemStruct || data?.note || data || {};
  const video = detail.video || data?.video || {};
  const candidates = [
    data?.durationSeconds,
    data?.lengthSeconds,
    data?.duration,
    data?.duration_sec,
    data?.durationMs,
    data?.duration_ms,
    detail?.durationSeconds,
    detail?.lengthSeconds,
    detail?.duration,
    detail?.duration_sec,
    detail?.durationMs,
    detail?.duration_ms,
    video?.duration,
    video?.duration_ms,
    video?.durationMs,
    video?.lengthSeconds,
    data?.videos?.items?.[0]?.lengthMs
  ];

  for (const value of candidates) {
    const seconds = normalizeDurationSeconds(value);
    if (seconds > 0) return seconds;
  }

  return 0;
}

function normalizeDurationSeconds(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'string') {
    const text = value.trim();
    if (/^\d+(?::\d+){1,2}$/.test(text)) {
      return text.split(':').reduce((total, part) => total * 60 + Number(part), 0);
    }
    const numeric = Number(text.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(numeric)) return 0;
    return numeric > 10000 ? numeric / 1000 : numeric;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return numeric > 10000 ? numeric / 1000 : numeric;
}

function calcAveragePriceFromGmv(grossGmv, orders) {
  const orderCount = Number(orders) || 0;
  if (orderCount <= 0) return 0;
  return roundMoney(Number(grossGmv || 0) / orderCount);
}

function syncProfitGmvForOrderCount(newOrderCount, oldOrderCount) {
  const nextOrders = Number(newOrderCount) || 0;
  const previousOrders = Number(oldOrderCount) || 0;
  if (nextOrders <= 0 || previousOrders <= 0 || nextOrders === previousOrders) return;

  const currentPrice = Number(profitForm.value.currentGrossGmv || 0) / previousOrders;
  const adjustedPrice = Number(profitForm.value.adjustedGrossGmv || 0) / previousOrders;
  profitForm.value.currentGrossGmv = roundMoney(currentPrice * nextOrders);
  profitForm.value.adjustedGrossGmv = roundMoney(adjustedPrice * nextOrders);
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function getProfitValue(resultValue, key) {
  const value = resultValue?.values?.[key];
  return Number.isFinite(value) ? value : 0;
}

function breakEvenStatus(actualRoi, breakEvenRoi) {
  const actual = Number(actualRoi) || 0;
  const target = Number(breakEvenRoi) || 0;
  if (target <= 0) return { className: 'danger', text: '无法保本' };
  if (actual >= target) return { className: 'success', text: `高于保本线 ${formatNumber(actual - target, 2)}` };
  return { className: 'danger', text: `低于保本线 ${formatNumber(target - actual, 2)}` };
}

function openProfitFormulaEditor(key) {
  const meta = profitFormulaMeta.find((item) => item.key === key);
  if (!meta) return;
  profitFormulaEditorKey.value = key;
  profitFormulaDraft.value = profitConfig.value.formulas?.[key] || defaultProfitConfig().formulas[key] || '';
  profitMessage.value = '';
  profitFormulaEditorOpen.value = true;
}

function closeProfitFormulaEditor() {
  profitFormulaEditorOpen.value = false;
  profitFormulaEditorKey.value = '';
  profitFormulaDraft.value = '';
}

async function saveProfitFormulaEditor() {
  if (!profitFormulaEditorKey.value) return;
  const previousConfig = normalizeProfitConfig(profitConfig.value);
  profitConfig.value = normalizeProfitConfig({
    ...profitConfig.value,
    formulas: {
      ...profitConfig.value.formulas,
      [profitFormulaEditorKey.value]: profitFormulaDraft.value
    }
  });
  await saveProfitConfig();
  if (profitMessageType.value === 'error') {
    profitConfig.value = previousConfig;
    return;
  }
  closeProfitFormulaEditor();
}

function resetProfitFormulaEditor() {
  if (!profitFormulaEditorKey.value) return;
  profitFormulaDraft.value = defaultProfitConfig().formulas[profitFormulaEditorKey.value] || '';
}

function runProfitScenario(price, roiOverride = profitForm.value.roi) {
  const form = profitForm.value;
  const preShipReturnRate = clampNumber(Number(form.preShipReturnRatePercent) / 100, 0, 0.999999);
  const postShipReturnRate = clampNumber(Number(form.postShipReturnRatePercent) / 100, 0, 0.999999);
  const returnRate = clampNumber(preShipReturnRate + postShipReturnRate, 0, 0.999999);
  const values = {
    orders: Math.max(0, Number(form.orderCount) || 0),
    price: Number(price) || 0,
    roi: Math.max(0.000001, Number(roiOverride) || 0),
    returnRate,
    preShipReturnRate,
    postShipReturnRate,
    cost: Math.max(0, Number(form.productCost) || 0),
    insurance: Math.max(0, Number(form.shippingInsurance) || 0),
    serviceRate: clampNumber(Number(form.platformFeePercent) / 100, 0, 1)
  };
  const errors = [];

  for (const meta of profitFormulaMeta) {
    const formula = profitConfig.value.formulas?.[meta.key] || defaultProfitConfig().formulas[meta.key];
    try {
      values[meta.key] = safeEvaluateFormula(formula, values);
      if (!Number.isFinite(values[meta.key])) values[meta.key] = 0;
    } catch (err) {
      values[meta.key] = 0;
      errors.push(`${meta.label}：${err.message}`);
    }
  }

  return { values, errors };
}

function safeEvaluateFormula(formula, variables) {
  const tokens = tokenizeFormula(formula);
  const output = [];
  const operators = [];
  const precedence = { '+': 1, '-': 1, '*': 2, '/': 2 };
  let previousType = 'start';

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type === 'number' || token.type === 'name') {
      output.push(token);
      previousType = token.type;
      continue;
    }
    if (token.value === '(') {
      operators.push(token);
      previousType = 'leftParen';
      continue;
    }
    if (token.value === ')') {
      while (operators.length && operators[operators.length - 1].value !== '(') output.push(operators.pop());
      if (!operators.length) throw new Error('括号不匹配');
      operators.pop();
      previousType = 'rightParen';
      continue;
    }
    if (token.type === 'operator') {
      if (token.value === '-' && ['start', 'operator', 'leftParen'].includes(previousType)) {
        output.push({ type: 'number', value: 0 });
      }
      while (
        operators.length
        && operators[operators.length - 1].type === 'operator'
        && precedence[operators[operators.length - 1].value] >= precedence[token.value]
      ) {
        output.push(operators.pop());
      }
      operators.push(token);
      previousType = 'operator';
    }
  }

  while (operators.length) {
    const token = operators.pop();
    if (token.value === '(' || token.value === ')') throw new Error('括号不匹配');
    output.push(token);
  }

  const stack = [];
  for (const token of output) {
    if (token.type === 'number') {
      stack.push(Number(token.value));
      continue;
    }
    if (token.type === 'name') {
      if (!Object.prototype.hasOwnProperty.call(variables, token.value)) throw new Error(`未知变量 ${token.value}`);
      stack.push(Number(variables[token.value]) || 0);
      continue;
    }
    const right = stack.pop();
    const left = stack.pop();
    if (left === undefined || right === undefined) throw new Error('公式格式不正确');
    if (token.value === '+') stack.push(left + right);
    if (token.value === '-') stack.push(left - right);
    if (token.value === '*') stack.push(left * right);
    if (token.value === '/') stack.push(right === 0 ? 0 : left / right);
  }
  if (stack.length !== 1) throw new Error('公式格式不正确');
  return stack[0];
}

function tokenizeFormula(formula) {
  const text = String(formula || '').trim();
  if (!text) throw new Error('公式不能为空');
  if (!/^[\w\s+\-*/().]+$/.test(text)) throw new Error('只能使用变量、数字、括号和 + - * /');

  const tokens = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let end = index + 1;
      while (end < text.length && /[0-9.]/.test(text[end])) end += 1;
      const value = text.slice(index, end);
      if (!/^\d*\.?\d+$/.test(value)) throw new Error(`数字格式不正确：${value}`);
      tokens.push({ type: 'number', value });
      index = end;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1;
      while (end < text.length && /\w/.test(text[end])) end += 1;
      tokens.push({ type: 'name', value: text.slice(index, end) });
      index = end;
      continue;
    }
    if ('+-*/()'.includes(char)) {
      tokens.push({ type: '+-*/'.includes(char) ? 'operator' : 'paren', value: char });
      index += 1;
      continue;
    }
    throw new Error(`不支持的字符：${char}`);
  }
  return tokens;
}

function formatMoney(value) {
  return `¥${(Number(value) || 0).toFixed(2)}`;
}

function formatNumber(value, digits = 2) {
  return (Number(value) || 0).toFixed(digits);
}

function formatPercent(value) {
  return `${((Number(value) || 0) * 100).toFixed(1)}%`;
}

function formatProfitMetric(key, value) {
  if (key === 'actualGrossMarginRate') return formatPercent(value);
  if (key === 'breakEvenRoi' || key === 'collectionBreakEvenRoi') return formatNumber(value, 2);
  if (String(key || '').includes('Orders')) return `${formatNumber(value, 0)} 单`;
  return formatMoney(value);
}

function profitFormulaTitle(key) {
  const meta = profitFormulaMeta.find((item) => item.key === key);
  return meta?.hint ? `${meta.hint} 双击可编辑公式。` : '双击可编辑公式。';
}

async function loadProfitConfig() {
  profitLoading.value = true;
  profitMessage.value = '';
  try {
    const response = await fetch('/api/profit-config');
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || 'ROI 公式配置加载失败。');
    profitStorageConfigured.value = payload.storageConfigured !== false;
    profitConfig.value = normalizeProfitConfig(payload.config);
    if (payload.message) {
      profitMessage.value = payload.message;
      profitMessageType.value = 'info';
    }
  } catch (err) {
    profitMessage.value = err.message || 'ROI 公式配置加载失败。';
    profitMessageType.value = 'error';
  } finally {
    profitLoading.value = false;
  }
}

function normalizeProfitConfig(config = {}) {
  const defaults = defaultProfitConfig();
  const formulas = {
    ...defaults.formulas,
    ...(config.formulas || {})
  };
  const legacyFormulas = [
    ['insuranceTotal', 'settledOrders * insurance'],
    ['insuranceTotal', 'orders * insurance'],
    ['withdrawBase', 'settledGmv - adCost - insuranceTotal'],
    ['platformFee', 'settledGmv * serviceRate'],
    ['profit', 'settledGmv - adCost - platformFee - productCostTotal - insuranceTotal'],
    ['profit', 'withdrawBase - platformFee - productCostTotal'],
    ['breakEvenRoi', 'grossGmv / (withdrawBase * (1 - serviceRate) - productCostTotal)'],
    ['breakEvenRoi', 'grossGmv / (settledGmv - platformFee - productCostTotal - insuranceTotal)'],
    ['breakEvenRoi', 'grossGmv / (settledGmv - insuranceTotal - productCostTotal / (1 - serviceRate))']
  ];
  if (config.version !== PROFIT_CONFIG_VERSION) {
    for (const [key, legacyFormula] of legacyFormulas) {
      if (!config.formulas?.[key] || config.formulas[key] === legacyFormula) {
        formulas[key] = defaults.formulas[key];
      }
    }
  }
  return {
    version: PROFIT_CONFIG_VERSION,
    updatedAt: config.updatedAt || null,
    formulas
  };
}

async function saveProfitConfig() {
  profitLoading.value = true;
  profitMessage.value = '';
  try {
    const response = await fetch('/api/profit-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: profitConfig.value })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || 'ROI 公式保存失败。');
    profitConfig.value = normalizeProfitConfig(payload.config);
    profitMessage.value = payload.message || 'ROI 公式已保存。';
    profitMessageType.value = 'success';
  } catch (err) {
    profitMessage.value = err.message || 'ROI 公式保存失败。';
    profitMessageType.value = 'error';
  } finally {
    profitLoading.value = false;
  }
}

async function resetProfitConfig() {
  profitLoading.value = true;
  profitMessage.value = '';
  try {
    const response = await fetch('/api/profit-config', { method: 'DELETE' });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '恢复默认公式失败。');
    profitConfig.value = normalizeProfitConfig(payload.config);
    profitMessage.value = payload.message || '已恢复默认公式。';
    profitMessageType.value = 'success';
  } catch (err) {
    profitMessage.value = err.message || '恢复默认公式失败。';
    profitMessageType.value = 'error';
  } finally {
    profitLoading.value = false;
  }
}

function navigate(path) {
  window.history.pushState({}, '', path);
  currentPath.value = path;
  if (path.startsWith('/en/')) lang.value = 'en';
  if (path === '/audio-extract') fileMode.value = 'audio';
  if (path === '/audio-to-text') fileMode.value = 'audio';
  if (path === '/local-audio-to-text') fileMode.value = 'audio';
  if (path === '/video-extract' || path === '/media-extract') fileMode.value = 'video';
  if (path === '/video-to-text') fileMode.value = 'video';
  if (path === '/local-video-to-text') fileMode.value = 'video';
  if (path === '/text') textMode.value = 'link';
  if (path === '/article' || path === '/wechat-article' || path === '/article-studio') articleView.value = 'text';
  resetResult();
  updateMeta();
  loadRouteData();
  trackEvent('page_view', { path });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleLang() {
  lang.value = lang.value === 'zh' ? 'en' : 'zh';
  localStorage.setItem('copypilot-lang', lang.value);
  updateMeta();
}

window.onpopstate = () => {
  currentPath.value = window.location.pathname;
  resetResult();
  updateMeta();
  loadRouteData();
  trackEvent('page_view', { path: currentPath.value, navigation: 'popstate' });
};

function updateMeta() {
  if (isProfitPage.value) {
    document.title = `ROI | ${siteName}`;
    updateMetaTags('电商广告投产、退货率、平台扣费、调价和 ROI 调整测算工具。');
    return;
  }
  if (isSharedListPage.value) {
    document.title = `共享视频池 | ${siteName}`;
    updateMetaTags('同事共享的视频素材列表，打开即可预览视频、复制文案或补充逐字稿。');
    return;
  }
  if (isShareDetailPage.value) {
    document.title = `${resultTitle.value || currentSharedRecord.value?.title || '共享视频'} | ${siteName}`;
    updateMetaTags('查看同事共享的视频素材，可直接预览视频、下载素材和提取逐字稿。');
    return;
  }
  const page = pageMap[currentPath.value];
  const activePage = toolPage.value || page;
  const seoPage = activeSeoPage.value;
  const title = seoPage?.title || (lang.value === 'en'
    ? activePage?.title || uiText.value.heroTitle
    : activePage?.seoTitle || activePage?.title || uiText.value.heroTitle);
  const description = seoPage?.description || activePage?.subtitle || uiText.value.heroSubtitle;
  document.title = `${title} | ${siteName}`;
  updateMetaTags(description);
}

function updateMetaTags(description) {
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'description');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', description);
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', `${window.location.origin}${currentPath.value}`);
}

async function loadRouteData() {
  if (isProfitPage.value) {
    await loadProfitConfig();
    await loadSharedVideos({ silent: true });
    return;
  }
  if (isSharedListPage.value) {
    await loadSharedVideos();
    return;
  }
  if (isShareDetailPage.value) {
    await loadSharedVideo(sharedVideoId.value);
    return;
  }
  await loadSharedVideos({ silent: true });
}

updateMeta();

function setExtractProgress(detail, percent, title = uiText.value.progressTitle) {
  extractProgress.value = {
    title,
    detail,
    percent: Math.max(8, Math.min(100, percent))
  };
}

async function extract() {
  error.value = '';
  notice.value = '';
  result.value = null;
  extractProgress.value = null;

  const cleanUrl = extractUrl(url.value);
  if (!cleanUrl) {
    error.value = '请先粘贴作品链接。';
    return;
  }

  const platform = detectPlatformFromUrl(cleanUrl);
  const targetType = toolPage.value?.type || 'auto';
  trackEvent('extract_start', { inputType: 'link', platform, targetType });
  loading.value = true;
  try {
    url.value = cleanUrl;
    const smartHome = isHome.value;
    const isWechatChannel = platform === 'wechat_channels';
    const endpoint = isWechatChannel
      ? '/api/wechat-channel-extract'
      : toolPage.value?.type === 'text' && textMode.value === 'link'
        ? '/api/transcribe-link'
        : '/api/extract';

    setExtractProgress(uiText.value.progressDetect, 16);
    if (smartHome) setExtractProgress(uiText.value.progressExtract, 36);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: cleanUrl, type: toolPage.value?.type || 'auto' })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(formatWechatExtractError(payload) || payload.message || '提取失败');
    result.value = payload.data;
    if (toolPage.value?.type === 'article') {
      articleView.value = 'layout';
      articleDraftHtml.value = buildWechatArticleHtml(articleBlocks.value, {
        title: resultTitle.value,
        template: articleTemplate.value
      });
    }

    setExtractProgress(uiText.value.progressFinalize, 94);
    if (!notice.value) {
      notice.value = result.value?.transcriptSkipped
        ? result.value.transcriptSkipReason || '免费版视频超过5分钟，已跳过视频文案识别。'
        : endpoint === '/api/transcribe-link' || result.value?.transcript
        ? '提取完成，已识别视频本身文案，并整理标题、素材和标签。'
        : videoLinks.value.length
          ? '提取完成，已整理标题、发布文案、标签和视频素材。需要逐字稿时可点击“提取逐字稿”。'
          : '提取完成，已整理标题、发布文案、标签和可用素材。';
    }
    trackEvent('extract_success', {
      inputType: 'link',
      platform,
      targetType,
      hasVideo: Boolean(videoLinks.value.length),
      hasImage: Boolean(imageLinks.value.length),
      hasTranscript: Boolean(result.value?.transcript)
    });
    await loadMe();
  } catch (err) {
    error.value = err.message === 'Failed to fetch'
      ? '接口请求失败或超时，请稍后重试；如果是小红书图文，请优先使用手机 App 复制的完整分享链接。'
      : err.message || '提取失败，请稍后重试。';
    trackEvent('extract_failed', {
      inputType: 'link',
      platform,
      targetType,
      reason: String(error.value || '').slice(0, 90)
    });
  } finally {
    loading.value = false;
    extractProgress.value = null;
  }
}

async function transcribeFile() {
  error.value = '';
  notice.value = '';
  result.value = null;

  if (!selectedFile.value) {
    error.value = '请先选择音频或视频文件。';
    return;
  }

  const durationSeconds = await getSelectedFileDuration(selectedFile.value);
  if (durationSeconds > FREE_TRANSCRIBE_MAX_SECONDS) {
    error.value = '免费版转文字仅支持 5 分钟以内的音视频，请选择更短的文件。';
    trackEvent('extract_blocked', {
      inputType: 'file',
      mediaType: fileMode.value,
      targetType: 'speech_to_text',
      durationBucket: durationBucket(durationSeconds),
      reason: 'free_duration_limit'
    });
    return;
  }

  trackEvent('extract_start', {
    inputType: 'file',
    mediaType: fileMode.value,
    targetType: 'speech_to_text',
    durationBucket: durationBucket(durationSeconds)
  });
  loading.value = true;
  try {
    setExtractProgress(uiText.value.progressUpload, 35);
    const form = new FormData();
    form.set('file', selectedFile.value);
    form.set('durationSeconds', String(Math.round(durationSeconds || 0)));
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: form
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '转写失败');
    result.value = {
      title: payload.data.title,
      text: payload.data.text
    };
    setExtractProgress(uiText.value.progressFinalize, 94);
    notice.value = '转写完成，已提取音视频中的文案。';
    trackEvent('extract_success', {
      inputType: 'file',
      mediaType: fileMode.value,
      targetType: 'speech_to_text',
      durationBucket: durationBucket(durationSeconds)
    });
    await loadMe();
  } catch (err) {
    error.value = err.message || '转写失败，请稍后重试。';
    trackEvent('extract_failed', {
      inputType: 'file',
      mediaType: fileMode.value,
      targetType: 'speech_to_text',
      durationBucket: durationBucket(durationSeconds),
      reason: String(error.value || '').slice(0, 90)
    });
  } finally {
    loading.value = false;
    extractProgress.value = null;
  }
}

function getSelectedFileDuration(file) {
  return new Promise((resolve) => {
    if (!file) {
      resolve(0);
      return;
    }
    const media = document.createElement(file.type?.startsWith('audio/') ? 'audio' : 'video');
    const objectUrl = URL.createObjectURL(file);
    media.preload = 'metadata';
    media.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(Number.isFinite(media.duration) ? media.duration : 0);
    };
    media.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(0);
    };
    media.src = objectUrl;
  });
}

function onFileChange(event) {
  selectedFile.value = event.target.files?.[0] || null;
  resetResult();
}

function extractUrl(value) {
  const text = String(value || '').trim();
  const match = text.match(/https?:\/\/[^\s，。]+/i);
  return match ? match[0] : text.startsWith('http') ? text : '';
}

async function paste() {
  error.value = '';
  try {
    url.value = await navigator.clipboard.readText();
    trackEvent('paste_link', { hasText: Boolean(url.value.trim()) });
  } catch {
    error.value = '无法读取剪贴板，请手动粘贴。';
  }
}

async function loadMe() {
  await loadSiteContent();
  await loadMembershipPlans();
  if (isPublicFreeMode) return;
  try {
    const response = await fetch('/api/auth/me');
    const payload = await response.json();
    if (payload.ok) {
      currentUser.value = payload.user ? { ...payload.user, isAdmin: payload.isAdmin } : null;
      usage.value = payload.usage;
      if (payload.user) {
        await loadRecords();
        if (payload.isAdmin) {
          await loadAdminUsers();
          await loadAdminPlans();
          await loadAdminSiteContent();
        }
      }
    }
  } catch {
    // 登录状态不影响主工具使用。
  }
}

async function loadSiteContent() {
  const response = await fetch('/api/site/content').catch(() => null);
  if (!response?.ok) return;
  const payload = await response.json().catch(() => null);
  if (payload?.ok && payload.content) siteContent.value = payload.content;
}

async function loadRecords() {
  if (!currentUser.value) {
    records.value = [];
    return;
  }
  const response = await fetch('/api/user/records').catch(() => null);
  if (!response?.ok) return;
  const payload = await response.json();
  if (payload.ok) records.value = payload.records || [];
}

async function loadMembershipPlans() {
  const response = await fetch('/api/membership/plans').catch(() => null);
  if (!response?.ok) return;
  const payload = await response.json().catch(() => null);
  if (payload?.ok && payload.plans?.length) membershipPlans.value = payload.plans;
}

async function loadAdminUsers() {
  if (!isAdmin.value) {
    adminUsers.value = [];
    adminTotal.value = 0;
    return;
  }
  adminLoading.value = true;
  adminMessage.value = '';
  try {
    const response = await fetch('/api/admin/users');
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '用户列表加载失败。');
    adminUsers.value = payload.users || [];
    adminTotal.value = payload.total || adminUsers.value.length;
  } catch (err) {
    adminMessage.value = err.message || '用户列表加载失败。';
  } finally {
    adminLoading.value = false;
  }
}

async function loadAdminPlans() {
  if (!isAdmin.value) {
    adminPlans.value = [];
    return;
  }
  adminLoading.value = true;
  adminMessage.value = '';
  try {
    const response = await fetch('/api/admin/membership-plans');
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '会员参数加载失败。');
    adminPlans.value = (payload.plans || []).map((plan) => ({
      ...plan,
      featuresText: (plan.features || []).join('\n')
    }));
  } catch (err) {
    adminMessage.value = err.message || '会员参数加载失败。';
  } finally {
    adminLoading.value = false;
  }
}

async function saveAdminPlans() {
  if (!isAdmin.value) return;
  adminLoading.value = true;
  adminMessage.value = '';
  try {
    const response = await fetch('/api/admin/membership-plans', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plans: adminPlans.value.map((plan) => ({
          ...plan,
          features: String(plan.featuresText || '')
            .split('\n')
            .map((item) => item.trim())
            .filter(Boolean)
        }))
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '会员参数保存失败。');
    adminPlans.value = (payload.plans || []).map((plan) => ({
      ...plan,
      featuresText: (plan.features || []).join('\n')
    }));
    await loadMembershipPlans();
    adminMessage.value = '会员参数已保存并生效。';
  } catch (err) {
    adminMessage.value = err.message || '会员参数保存失败。';
  } finally {
    adminLoading.value = false;
  }
}

async function loadAdminSiteContent() {
  if (!isAdmin.value) {
    adminSiteContent.value = null;
    return;
  }
  adminLoading.value = true;
  adminMessage.value = '';
  try {
    const response = await fetch('/api/admin/site-content');
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '站点文案加载失败。');
    adminSiteContent.value = normalizeEditableSiteContent(payload.content);
  } catch (err) {
    adminMessage.value = err.message || '站点文案加载失败。';
  } finally {
    adminLoading.value = false;
  }
}

async function saveAdminSiteContent() {
  if (!isAdmin.value || !adminSiteContent.value) return;
  adminLoading.value = true;
  adminMessage.value = '';
  try {
    const response = await fetch('/api/admin/site-content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: serializeEditableSiteContent(adminSiteContent.value) })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '站点文案保存失败。');
    adminSiteContent.value = normalizeEditableSiteContent(payload.content);
    siteContent.value = payload.content;
    adminMessage.value = '站点文案已保存并生效。';
  } catch (err) {
    adminMessage.value = err.message || '站点文案保存失败。';
  } finally {
    adminLoading.value = false;
  }
}

function normalizeEditableSiteContent(content) {
  const clone = structuredClone(content || {});
  for (const locale of ['zh', 'en']) {
    clone[locale] ||= {};
    clone[locale].uiText ||= {};
    clone[locale].uiText.placeholders ||= {};
    clone[locale].toolPages = normalizeEditableToolPages(locale, clone[locale].toolPages);
    clone[locale].featureCards = (clone[locale].featureCards || []).map((item) => ({
      title: item.title || '',
      text: item.text || ''
    }));
    clone[locale].steps = (clone[locale].steps || []).map(([title, text]) => ({ title: title || '', text: text || '' }));
    clone[locale].faqs = (clone[locale].faqs || []).map(([question, answer]) => ({ question: question || '', answer: answer || '' }));
  }
  return clone;
}

function serializeEditableSiteContent(content) {
  const output = structuredClone(content || {});
  for (const locale of ['zh', 'en']) {
    output[locale] ||= {};
    output[locale].steps = (output[locale].steps || []).map((item) => [item.title || '', item.text || '']);
    output[locale].faqs = (output[locale].faqs || []).map((item) => [item.question || '', item.answer || '']);
  }
  return output;
}

function normalizeEditableToolPages(locale, pages) {
  const defaults = defaultEditableToolPages(locale);
  const output = {};
  for (const [path, page] of Object.entries(defaults)) {
    output[path] = {
      ...page,
      ...(pages?.[path] || {})
    };
  }
  return output;
}

function defaultEditableToolPages(locale) {
  const output = {};
  for (const [path, page] of Object.entries(pageMap)) {
    const localizedPage = locale === 'en' ? { ...page, ...(enPageMap[path] || {}) } : page;
    output[path] = {
      badge: localizedPage.badge || '',
      title: localizedPage.title || '',
      subtitle: localizedPage.subtitle || '',
      seoTitle: localizedPage.seoTitle || ''
    };
  }
  return output;
}

function addEditableItem(list, item) {
  list.push(item);
}

function removeEditableItem(list, index) {
  list.splice(index, 1);
}

async function saveAdminUser(user) {
  if (!isAdmin.value || !user?.id) return;
  adminLoading.value = true;
  adminMessage.value = '';
  try {
    const response = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.id,
        plan: user.plan,
        credits: Number(user.credits || 0)
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '用户更新失败。');
    adminUsers.value = adminUsers.value.map((item) => item.id === payload.user.id ? payload.user : item);
    adminMessage.value = '用户已更新。';
  } catch (err) {
    adminMessage.value = err.message || '用户更新失败。';
  } finally {
    adminLoading.value = false;
  }
}

async function sendEmailCode() {
  authLoading.value = true;
  authMessage.value = '';
  devCode.value = '';
  try {
    const response = await fetch('/api/auth/send-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail.value })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '验证码发送失败。');
    authMessage.value = payload.message || '验证码已发送。';
    devCode.value = payload.devCode || '';
  } catch (err) {
    authMessage.value = err.message || '验证码发送失败。';
  } finally {
    authLoading.value = false;
  }
}

async function verifyEmailCode() {
  authLoading.value = true;
  authMessage.value = '';
  try {
    const response = await fetch('/api/auth/verify-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: authEmail.value, code: authCode.value })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '登录失败。');
    currentUser.value = payload.user;
    authOpen.value = false;
    authCode.value = '';
    await loadMe();
  } catch (err) {
    authMessage.value = err.message || '登录失败。';
  } finally {
    authLoading.value = false;
  }
}

function loginWithGoogle() {
  window.location.href = '/api/auth/google';
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null);
  currentUser.value = null;
  records.value = [];
  adminUsers.value = [];
  adminTotal.value = 0;
  adminPlans.value = [];
  adminSiteContent.value = null;
  await loadMe();
}

function clearInput() {
  url.value = '';
  resetResult();
  nextTick(() => {
    const el = urlInput.value;
    if (el) {
      el.style.height = 'auto';
      el.style.height = el.scrollHeight + 'px';
    }
  });
}

function sharedVideoPayload() {
  return {
    title: resultTitle.value || makeTitleFromDescription(publishedText.value || resultText.value) || `${resultAuthor.value || '同事'}的视频`,
    description: publishedText.value || resultText.value || '',
    author: resultAuthor.value,
    cover: resultCover.value,
    platform: result.value?.platform || (url.value ? detectPlatformFromUrl(url.value) : ''),
    sourceUrl: extractUrl(url.value) || result.value?.sourceUrl || '',
    result: result.value || {}
  };
}

function loadViewedSharedIds() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SHARED_VIEWED_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
  } catch {
    return [];
  }
}

function persistViewedSharedIds() {
  localStorage.setItem(SHARED_VIEWED_KEY, JSON.stringify(viewedSharedIds.value.slice(0, 300)));
}

function isSharedVideoUnread(id) {
  return Boolean(id && !viewedSharedIds.value.includes(String(id)));
}

function markSharedVideoViewed(id) {
  const cleanId = String(id || '').trim();
  if (!cleanId || viewedSharedIds.value.includes(cleanId)) return;
  viewedSharedIds.value = [cleanId, ...viewedSharedIds.value].slice(0, 300);
  persistViewedSharedIds();
}

async function deleteSharedVideoItem(item) {
  const id = typeof item === 'string' ? item : item?.id;
  if (!id) return;
  const title = typeof item === 'object' ? item.title : currentSharedRecord.value?.title;
  const confirmed = window.confirm(`确定删除${title ? `「${title}」` : '这条共享视频'}吗？删除后同事也看不到这条记录。`);
  if (!confirmed) return;

  sharedLoading.value = true;
  sharedError.value = '';
  try {
    const response = await fetch(`/api/shared-videos/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '删除失败。');
    sharedVideos.value = sharedVideos.value.filter((video) => video.id !== id);
    viewedSharedIds.value = viewedSharedIds.value.filter((viewedId) => viewedId !== id);
    persistViewedSharedIds();
    sharedMessage.value = '共享视频已删除。';
    notice.value = sharedMessage.value;
    if (isShareDetailPage.value && sharedVideoId.value === id) {
      navigate('/shared');
    }
  } catch (err) {
    sharedError.value = err.message || '删除失败，请稍后重试。';
  } finally {
    sharedLoading.value = false;
  }
}

async function shareCurrentVideo() {
  if (!result.value || !videoLinks.value.length) {
    error.value = '请先解析出可预览的视频，再分享给同事。';
    return;
  }
  shareLoading.value = true;
  sharedMessage.value = '';
  try {
    const response = await fetch('/api/shared-videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sharedVideoPayload())
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '共享失败。');
    const absoluteUrl = `${window.location.origin}${payload.shareUrl}`;
    await navigator.clipboard.writeText(absoluteUrl).catch(() => null);
    if (payload.item?.id) {
      markSharedVideoViewed(payload.item.id);
      sharedVideos.value = [payload.item, ...sharedVideos.value.filter((item) => item.id !== payload.item.id)];
    }
    sharedMessage.value = payload.duplicate
      ? '这个链接已经保存过了，原共享链接已复制。'
      : '已加入共享视频池，分享链接已复制。';
    notice.value = sharedMessage.value;
    trackEvent('share_video', {
      platform: result.value?.platform || '',
      hasTranscript: Boolean(result.value?.transcript),
      duplicate: Boolean(payload.duplicate)
    });
  } catch (err) {
    error.value = err.message || '共享失败，请稍后重试。';
  } finally {
    shareLoading.value = false;
  }
}

async function loadSharedVideos(options = {}) {
  const silent = Boolean(options.silent);
  if (!silent) {
    sharedLoading.value = true;
    sharedError.value = '';
  }
  try {
    const response = await fetch('/api/shared-videos');
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '共享视频列表读取失败。');
    sharedVideos.value = Array.isArray(payload.items) ? payload.items : [];
  } catch (err) {
    if (!silent) sharedError.value = err.message || '共享视频列表读取失败。';
  } finally {
    if (!silent) sharedLoading.value = false;
  }
}

async function loadSharedVideo(id) {
  if (!id) return;
  sharedLoading.value = true;
  sharedError.value = '';
  currentSharedRecord.value = null;
  try {
    const response = await fetch(`/api/shared-videos/${encodeURIComponent(id)}`);
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '共享视频读取失败。');
    currentSharedRecord.value = payload.record;
    result.value = payload.record?.result || {};
    url.value = payload.record?.sourceUrl || '';
    markSharedVideoViewed(payload.record?.id || id);
    notice.value = payload.record?.result?.transcript
      ? '已载入共享视频和逐字稿。'
      : '已载入共享视频，可直接观看；需要逐字稿时可点击提取。';
    await nextTick();
    updateMeta();
  } catch (err) {
    sharedError.value = err.message || '共享视频读取失败。';
    result.value = null;
  } finally {
    sharedLoading.value = false;
  }
}

async function updateSharedTranscript(text) {
  if (!isShareDetailPage.value || !sharedVideoId.value || !text) return;
  try {
    const response = await fetch(`/api/shared-videos/${encodeURIComponent(sharedVideoId.value)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transcript: text,
        result: result.value || {}
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '共享逐字稿保存失败。');
    currentSharedRecord.value = payload.record;
    sharedMessage.value = '逐字稿已同步到共享视频。';
  } catch (err) {
    sharedMessage.value = err.message || '逐字稿已提取，但同步到共享视频失败。';
  }
}

function formatWechatExtractError(payload) {
  if (!payload?.error) return '';
  if (payload.error === 'WECHAT_COOKIE_MISSING') {
    return '视频号解析 Cookie 未配置，暂时无法解析微信视频号链接。请进入系统配置页面填写腾讯元宝 Cookie。';
  }
  if (payload.error === 'WECHAT_COOKIE_EXPIRED') {
    return '视频号解析失败，可能是腾讯元宝 Cookie 已过期。请进入系统配置页面，重新粘贴腾讯元宝 Cookie 后再试。';
  }
  if (payload.error === 'WECHAT_URL_INVALID') {
    return '不是有效的微信视频号分享链接，请粘贴 weixin.qq.com/sph/ 开头的链接。';
  }
  return payload.message || '';
}

async function loadWechatCookieStatus() {
  try {
    const response = await fetch('/api/admin/wechat-cookie/status');
    const payload = await response.json();
    if (payload?.ok) {
      wechatCookieStatus.value = {
        configured: Boolean(payload.configured),
        storageConfigured: Boolean(payload.storageConfigured),
        updatedAt: payload.updatedAt || null,
        preview: payload.preview || '',
        lastTestAt: payload.lastTestAt || null,
        lastTestResult: payload.lastTestResult || null
      };
    }
  } catch {
    // The status panel can still render with its default state.
  }
}

async function openSystemConfig() {
  configOpen.value = true;
  configMessage.value = '';
  configMessageType.value = 'success';
  configWechatCookie.value = '';
  await loadWechatCookieStatus();
}

async function saveWechatCookieConfig() {
  configMessage.value = '';
  configMessageType.value = 'success';
  configLoading.value = true;
  try {
    const response = await fetch('/api/admin/wechat-cookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cookie: configWechatCookie.value
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '保存失败。');
    configWechatCookie.value = '';
    configMessage.value = payload.message || '保存成功，视频号解析 Cookie 已更新。';
    configMessageType.value = 'success';
    await loadWechatCookieStatus();
  } catch (err) {
    configMessage.value = err.message || '保存失败，请稍后重试。';
    configMessageType.value = 'error';
  } finally {
    configLoading.value = false;
  }
}

async function testWechatCookieConfig() {
  configMessage.value = '';
  configMessageType.value = 'success';
  configLoading.value = true;
  try {
    const response = await fetch('/api/admin/wechat-cookie/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: configTestUrl.value
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || '测试失败。');
    configMessage.value = payload.message || '测试成功，当前 Cookie 可用。';
    configMessageType.value = 'success';
    await loadWechatCookieStatus();
  } catch (err) {
    configMessage.value = err.message || '测试失败，Cookie 可能已过期或格式不完整，请重新从腾讯元宝复制 Cookie。';
    configMessageType.value = 'error';
    await loadWechatCookieStatus();
  } finally {
    configLoading.value = false;
  }
}

function autoResizeTextarea(event) {
  const el = event.target;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

async function copyText(value, options = {}) {
  const text = typeof value === 'string' ? value : resultText.value;
  if (!text) return;
  await navigator.clipboard.writeText(text);
  notice.value = '文案已复制。';
  if (options.feedback === 'transcript') {
    transcriptCopyDone.value = true;
    if (transcriptCopyTimer) clearTimeout(transcriptCopyTimer);
    transcriptCopyTimer = window.setTimeout(() => {
      transcriptCopyDone.value = false;
      transcriptCopyTimer = null;
    }, 1600);
  }
  trackEvent('copy_text', {
    targetType: toolPage.value?.type || 'auto',
    textLength: text.length
  });
}

async function copyArticleHtml() {
  if (!articleCopyHtml.value) return;
  const plainText = stripHtml(articleCopyHtml.value);

  if (window.ClipboardItem && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([articleCopyHtml.value], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' })
      })
    ]);
  } else {
    await navigator.clipboard.writeText(plainText);
  }
  notice.value = '公众号排版已复制，可以粘贴到编辑器。';
  trackEvent('copy_article_html', {
    targetType: 'article',
    textLength: plainText.length
  });
}

async function transcribeExtractedVideo(mode = 'precise') {
  const videoUrl = videoLinks.value[0];
  if (!videoUrl) {
    error.value = '请先提取到可用的视频链接。';
    return;
  }

  const cleanUrl = extractUrl(url.value);
  const durationSeconds = getResultDurationSeconds(result.value);
  transcriptMode.value = mode;
  transcriptLiveText.value = '';
  setTranscriptProgress('source', '正在连接阿里云工作台...');
  videoTranscriptLoading.value = true;
  error.value = '';

  notice.value = '正在连接阿里云工作台...';
  await nextTick();
  scrollToTranscriptProgress();

  trackEvent('extract_start', {
    inputType: 'extracted_video',
    platform: cleanUrl ? detectPlatformFromUrl(cleanUrl) : 'direct_video',
    targetType: 'video_transcript',
    mode,
    durationBucket: durationBucket(durationSeconds)
  });

  try {
    const payload = await transcribeWithAliyunStream({
      url: cleanUrl,
      videoUrl,
      videoUrls: videoLinks.value,
      sourceData: result.value,
      title: resultTitle.value,
      publishedText: publishedText.value,
      durationSeconds,
      mode
    });
    if (!payload.ok) throw new Error(formatApiError(payload, '视频逐字稿提取失败'));

    const text = payload.data?.transcript || payload.data?.text || '';
    if (!text) throw new Error('阿里云逐字稿接口已返回，但没有识别到文案内容。');

    setTranscriptProgress('result', '逐字稿已整理完成');
    result.value = {
      ...result.value,
      ...payload.data,
      transcript: text,
      text,
      publishedText: payload.data?.publishedText || publishedText.value
    };
    saveTranscriptHistoryItem({
      title: resultTitle.value,
      url: cleanUrl,
      text
    });
    await updateSharedTranscript(text);
    notice.value = '✓ 视频逐字稿已提取完成';
    trackEvent('extract_success', {
      inputType: 'extracted_video',
      targetType: 'video_transcript',
      mode: 'aliyun-qwen',
      hasTranscript: true
    });
    await loadMe();
    await nextTick();
    scrollToTranscriptResult();
    return;
  } catch (err) {
    error.value = err.message || '视频逐字稿提取失败，请稍后重试。';
    notice.value = '';
    trackEvent('extract_failed', {
      inputType: 'extracted_video',
      targetType: 'video_transcript',
      mode,
      reason: String(error.value || '').slice(0, 90)
    });
  } finally {
    videoTranscriptLoading.value = false;
    transcriptMode.value = '';
  }
}

function scrollToTranscriptProgress() {
  setTimeout(() => {
    const progressPanel = document.getElementById('video-transcript-progress');
    if (progressPanel) {
      progressPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 80);
}

function scrollToTranscriptResult() {
  setTimeout(() => {
    const transcriptPanel = document.getElementById('video-transcript-result');
    if (transcriptPanel) {
      transcriptPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, 120);
}

function loadTranscriptHistory() {
  try {
    const items = JSON.parse(localStorage.getItem('copypilot-transcript-history') || '[]');
    return Array.isArray(items) ? items.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function saveTranscriptHistoryItem(item) {
  const normalized = {
    id: item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    createdAt: item.createdAt || Date.now(),
    title: String(item.title || '未识别到标题').slice(0, 80),
    url: String(item.url || ''),
    text: String(item.text || '')
  };
  if (!normalized.text.trim()) return;

  const dedupeKey = normalized.url || normalized.title;
  const next = [
    normalized,
    ...transcriptHistory.value.filter((historyItem) => {
      const historyKey = historyItem.url || historyItem.title;
      return historyKey !== dedupeKey;
    })
  ].slice(0, 20);
  transcriptHistory.value = next;
  localStorage.setItem('copypilot-transcript-history', JSON.stringify(next));
}

function applyTranscriptHistoryItem(item) {
  if (!item?.text) return;
  result.value = {
    ...result.value,
    title: item.title || resultTitle.value,
    transcript: item.text,
    text: item.text,
    publishedText: publishedText.value
  };
  notice.value = '已载入历史逐字稿。';
  nextTick(() => scrollToTranscriptResult());
}

function deleteTranscriptHistoryItem(item) {
  if (!item?.id) return;
  const next = transcriptHistory.value.filter((historyItem) => historyItem.id !== item.id);
  transcriptHistory.value = next;
  localStorage.setItem('copypilot-transcript-history', JSON.stringify(next));
}

function formatHistoryTime(timestamp) {
  const date = new Date(timestamp || Date.now());
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function normalizeTranscriptStage(stage) {
  const value = String(stage || '').trim();
  if (value === 'asr-fallback' || value === 'delta') return 'asr';
  if (value === 'done') return 'result';
  if (['source', 'download', 'extract_audio', 'asr', 'result'].includes(value)) return value;
  return 'source';
}

function setTranscriptProgress(stage, message) {
  const normalized = normalizeTranscriptStage(stage);
  transcriptProgress.value = {
    stage: normalized,
    message: message || transcriptProgress.value.message || ''
  };
  notice.value = transcriptProgress.value.message;
}

async function transcribeWithAliyunStream(requestBody) {
  const response = await fetch('/api/aliyun-transcribe-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(requestBody)
  });

  const contentType = response.headers.get('Content-Type') || response.headers.get('content-type') || '';
  if (!response.ok || !contentType.toLowerCase().includes('text/event-stream') || !response.body) {
    const payload = await readJsonResponse(response, '阿里云流式逐字稿接口');
    throw new Error(formatApiError(payload, '视频逐字稿提取失败'));
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let resultPayload = null;

  async function handleBlock(block) {
    const lines = block.split(/\r?\n/);
    let event = 'message';
    const dataLines = [];
    for (const line of lines) {
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
    }
    if (!dataLines.length) return;

    let payload = {};
    try {
      payload = JSON.parse(dataLines.join('\n'));
    } catch {
      return;
    }

    if (event === 'status') {
      setTranscriptProgress(payload.stage, payload.message || '正在处理逐字稿...');
      return;
    }
    if (event === 'delta') {
      const text = payload.fullText || payload.text || '';
      if (text) transcriptLiveText.value = text;
      setTranscriptProgress('asr', text ? `千问 ASR 正在转写，已识别 ${text.length} 字` : '千问 ASR 正在转写');
      return;
    }
    if (event === 'result') {
      resultPayload = payload;
      setTranscriptProgress('result', '正在整理识别结果');
      return;
    }
    if (event === 'error') {
      throw new Error(payload.message || '阿里云逐字稿提取失败。');
    }
  }

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split(/\n\n|\r\n\r\n/);
    buffer = blocks.pop() || '';
    for (const block of blocks) {
      await handleBlock(block);
    }
  }
  if (buffer.trim()) await handleBlock(buffer);

  if (resultPayload) return resultPayload;
  const text = transcriptLiveText.value.trim();
  if (text) return { ok: true, data: { transcript: text, text } };
  return { ok: false, message: '阿里云逐字稿接口结束了流式响应，但没有返回识别结果。' };
}

function formatApiError(payload, fallback) {
  const parts = [payload?.message || fallback];
  if (payload?.upstreamUrl) parts.push(`upstreamUrl：${payload.upstreamUrl}`);
  if (payload?.status) parts.push(`status：${payload.status}`);
  if (payload?.contentType) parts.push(`content-type：${payload.contentType}`);
  if (payload?.responsePreview) parts.push(`响应前300字：${payload.responsePreview}`);
  return parts.filter(Boolean).join('；');
}

async function readJsonResponse(response, label = '接口') {
  const contentType = response.headers.get('Content-Type') || response.headers.get('content-type') || '';
  const text = await response.text();
  const preview = text.slice(0, 300);
  const upstreamUrl = response.url || '/api/aliyun-transcribe-link';

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error(`${label}没有返回 JSON。upstreamUrl：${upstreamUrl}；状态码：${response.status}；content-type：${contentType || '空'}；响应前300字：${preview || '空响应'}`);
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${label}返回 JSON 解析失败：${err.message}。upstreamUrl：${upstreamUrl}；状态码：${response.status}；content-type：${contentType || '空'}；响应前300字：${preview || '空响应'}`);
  }
}

function syncArticleDraft(event) {
  articleDraftHtml.value = event.currentTarget?.innerHTML || '';
}

function applyArticleTemplate() {
  if (!articleBlocks.value.length && !articleDraftHtml.value) return;
  articleDraftHtml.value = buildWechatArticleHtml(articleBlocks.value, {
    title: resultTitle.value,
    template: articleTemplate.value
  });
  articleView.value = 'layout';
  notice.value = '已按当前模板重新排版。';
}

async function rewriteArticle() {
  if (!resultText.value.trim()) {
    error.value = '请先提取到文章正文。';
    return;
  }

  trackEvent('rewrite_start', {
    targetType: 'article',
    template: articleTemplate.value,
    textLength: resultText.value.length,
    imageCount: imageLinks.value.length
  });
  articleRewriteLoading.value = true;
  error.value = '';
  notice.value = '';
  articleView.value = 'layout';

  try {
    const response = await fetch('/api/rewrite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'wechat_article',
        title: resultTitle.value,
        text: resultText.value,
        template: articleTemplate.value,
        images: imageLinks.value.slice(0, 12)
      })
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.message || 'AI 二创失败');
    articleDraftHtml.value = payload.data?.html || buildWechatArticleHtml(
      splitArticleParagraphs(payload.data?.text || resultText.value).map((text) => ({ type: 'text', text })),
      { title: payload.data?.title || resultTitle.value, template: articleTemplate.value }
    );
    notice.value = payload.data?.aiUsed ? 'AI 二创排版已生成，可以继续手动修改。' : '已生成一版本地规则排版稿，可以继续手动修改。';
    trackEvent('rewrite_success', {
      targetType: 'article',
      template: articleTemplate.value,
      aiUsed: Boolean(payload.data?.aiUsed)
    });
  } catch (err) {
    error.value = err.message || 'AI 二创失败，请稍后再试。';
    trackEvent('rewrite_failed', {
      targetType: 'article',
      template: articleTemplate.value,
      reason: String(error.value || '').slice(0, 90)
    });
  } finally {
    articleRewriteLoading.value = false;
  }
}

function resetResult() {
  error.value = '';
  notice.value = '';
  result.value = null;
  sharedMessage.value = '';
  if (!isShareDetailPage.value) currentSharedRecord.value = null;
  articleView.value = 'text';
  articleDraftHtml.value = '';
  articleRewriteLoading.value = false;
  videoTranscriptLoading.value = false;
}

function smoothScrollTo(targetY, duration = 900) {
  const startY = window.scrollY;
  const distance = targetY - startY;
  const startTime = performance.now();

  function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeInOutCubic(progress);
    window.scrollTo(0, startY + distance * eased);
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

watch(extractProgress, async (val, oldVal) => {
  if (val && !oldVal) {
    await nextTick();
    const el = document.getElementById('extract-progress');
    if (el) smoothScrollTo(el.offsetTop - 20);
  }
});

watch(hasResultContent, async (val, oldVal) => {
  if (val && !oldVal) {
    await nextTick();
    smoothScrollTo(document.documentElement.scrollHeight);
  }
});

watch(
  () => profitForm.value.orderCount,
  (newOrderCount) => {
    syncProfitGmvForOrderCount(newOrderCount, previousProfitOrderCount);
    const nextOrders = Number(newOrderCount) || 0;
    if (nextOrders > 0) previousProfitOrderCount = nextOrders;
  }
);

const showBackToTop = ref(false);

function onScroll() {
  showBackToTop.value = window.scrollY > 400;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'auto' });
}

onMounted(async () => {
  await loadMe();
  await loadWechatCookieStatus();
  await loadRouteData();
  trackEvent('page_view', { path: currentPath.value });
  window.addEventListener('scroll', onScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll);
  if (transcriptCopyTimer) clearTimeout(transcriptCopyTimer);
});
</script>

<template>
  <div class="site" :class="[`theme-${pageTheme}`, { 'home-page': isHome }]">
    <div v-if="authOpen && !isPublicFreeMode" class="auth-overlay" @click.self="authOpen = false">
      <section class="auth-panel">
        <button class="auth-close" @click="authOpen = false">×</button>
        <div v-if="!currentUser">
          <p class="eyebrow">账号登录</p>
          <h2>登录后获得更多提取额度</h2>
          <p class="auth-muted">邮箱验证码登录不需要密码。Google 登录需要先配置 OAuth。</p>
          <button class="google-button" @click="loginWithGoogle">使用 Google 登录</button>
          <div class="auth-divider">或使用邮箱验证码</div>
          <input v-model="authEmail" class="auth-input" placeholder="输入邮箱" type="email" />
          <div class="auth-code-row">
            <input v-model="authCode" class="auth-input" placeholder="6 位验证码" inputmode="numeric" />
            <button class="secondary-button" :disabled="authLoading" @click="sendEmailCode">
              {{ authLoading ? '处理中' : '发验证码' }}
            </button>
          </div>
          <button class="primary-button auth-submit" :disabled="authLoading" @click="verifyEmailCode">登录 / 注册</button>
          <p v-if="authMessage" class="auth-message">{{ authMessage }}</p>
          <p v-if="devCode" class="auth-dev">测试验证码：{{ devCode }}</p>
        </div>
        <div v-else>
          <p class="eyebrow">用户中心</p>
          <h2>{{ currentUser.email }}</h2>
          <div class="account-stats">
            <article>
              <span>当前会员</span>
              <strong>{{ currentPlanLabel }}</strong>
            </article>
            <article>
              <span>账号状态</span>
              <strong>正常</strong>
            </article>
            <article>
              <span>登录方式</span>
              <strong>验证码</strong>
            </article>
          </div>
          <div class="membership-panel">
            <div class="membership-heading">
              <h3>会员套餐</h3>
              <p>前台按会员权益展示，后台按成本额度控制，不向用户展示积分消耗。</p>
            </div>
            <div class="membership-grid">
              <article
                v-for="plan in membershipPlans"
                :key="plan.id"
                :class="{ active: currentUser.plan === plan.id || (currentUser.plan === 'pro' && plan.id === 'monthly') }"
              >
                <span v-if="plan.tag" class="plan-tag">{{ plan.tag }}</span>
                <h4>{{ plan.name }}</h4>
                <strong>{{ plan.price }}</strong>
                <p>{{ plan.note }}</p>
                <ul>
                  <li v-for="feature in plan.features" :key="feature">{{ feature }}</li>
                </ul>
              </article>
            </div>
          </div>
          <div class="record-list">
            <h3>最近提取记录</h3>
            <p v-if="!records.length" class="auth-muted">暂无记录。</p>
            <article v-for="item in records" :key="item.id">
              <strong>{{ item.result_title || item.action }}</strong>
              <span>{{ new Date(item.created_at).toLocaleString() }}</span>
            </article>
          </div>
          <div v-if="isAdmin" class="admin-panel">
            <div class="admin-heading">
              <div>
                <h3>用户管理</h3>
                <p>共 {{ adminTotal }} 个用户，可调整前台套餐和后台内部额度。</p>
              </div>
              <button class="secondary-button" :disabled="adminLoading" @click="loadAdminUsers">
                {{ adminLoading ? '刷新中' : '刷新' }}
              </button>
            </div>
            <p v-if="adminMessage" class="auth-message">{{ adminMessage }}</p>
            <div v-if="adminPlans.length" class="admin-plan-editor">
              <div class="admin-heading compact">
                <div>
                  <h3>会员参数配置</h3>
                  <p>这里保存后会写入数据库，前台会员卡片和后端额度限制会立即读取新配置。</p>
                </div>
                <button class="primary-button" :disabled="adminLoading" @click="saveAdminPlans">
                  {{ adminLoading ? '保存中' : '保存会员参数' }}
                </button>
              </div>
              <article v-for="plan in adminPlans" :key="plan.planKey" class="admin-plan-row">
                <div class="admin-plan-title">
                  <strong>{{ formatPlanName(plan.planKey) }}</strong>
                  <label>
                    <input v-model="plan.enabled" type="checkbox" />
                    前台显示
                  </label>
                </div>
                <label>
                  名称
                  <input v-model="plan.name" class="admin-input" />
                </label>
                <label>
                  前台价格文案
                  <input v-model="plan.priceLabel" class="admin-input" />
                </label>
                <label>
                  价格，单位分
                  <input v-model.number="plan.priceCents" class="admin-input" type="number" min="0" />
                </label>
                <label>
                  后台内部额度
                  <input v-model.number="plan.internalCredits" class="admin-input" type="number" min="0" />
                </label>
                <label>
                  每日可用次数
                  <input v-model.number="plan.dailyLimit" class="admin-input" type="number" min="1" />
                </label>
                <label>
                  最长转写分钟
                  <input v-model.number="plan.maxVideoMinutes" class="admin-input" type="number" min="1" max="240" />
                </label>
                <label>
                  推荐角标
                  <input v-model="plan.badge" class="admin-input" placeholder="例如：推荐" />
                </label>
                <label class="wide">
                  套餐说明
                  <input v-model="plan.description" class="admin-input" />
                </label>
                <label class="wide">
                  权益，每行一条
                  <textarea v-model="plan.featuresText" class="admin-textarea"></textarea>
                </label>
              </article>
            </div>
            <div v-if="adminSiteContent" class="admin-copy-editor">
              <div class="admin-heading compact">
                <div>
                  <h3>站点文案管理</h3>
                  <p>这里改的是前台运营文案，保存后首页、FAQ、按钮和 Footer 会立即读取新文案。</p>
                </div>
                <button class="primary-button" :disabled="adminLoading" @click="saveAdminSiteContent">
                  {{ adminLoading ? '保存中' : '保存站点文案' }}
                </button>
              </div>
              <div class="copy-lang-tabs">
                <button
                  type="button"
                  :class="{ active: adminCopyLang === 'zh' }"
                  @click="adminCopyLang = 'zh'"
                >中文</button>
                <button
                  type="button"
                  :class="{ active: adminCopyLang === 'en' }"
                  @click="adminCopyLang = 'en'"
                >English</button>
              </div>
              <div class="admin-copy-grid">
                <label>
                  导航：首页
                  <input v-model="adminSiteContent[adminCopyLang].uiText.nav[0]" class="admin-input" />
                </label>
                <label>
                  导航：视频
                  <input v-model="adminSiteContent[adminCopyLang].uiText.nav[1]" class="admin-input" />
                </label>
                <label>
                  导航：文案
                  <input v-model="adminSiteContent[adminCopyLang].uiText.nav[2]" class="admin-input" />
                </label>
                <label>
                  导航：图文
                  <input v-model="adminSiteContent[adminCopyLang].uiText.nav[3]" class="admin-input" />
                </label>
                <label>
                  导航：文章
                  <input v-model="adminSiteContent[adminCopyLang].uiText.nav[4]" class="admin-input" />
                </label>
                <label>
                  登录按钮
                  <input v-model="adminSiteContent[adminCopyLang].uiText.login" class="admin-input" />
                </label>
                <label>
                  首页小标签
                  <input v-model="adminSiteContent[adminCopyLang].uiText.heroBadge" class="admin-input" />
                </label>
                <label>
                  首页大标题
                  <input v-model="adminSiteContent[adminCopyLang].uiText.heroTitle" class="admin-input" />
                </label>
                <label class="wide">
                  首页小字
                  <textarea v-model="adminSiteContent[adminCopyLang].uiText.heroSubtitle" class="admin-textarea"></textarea>
                </label>
                <label>
                  开始按钮
                  <input v-model="adminSiteContent[adminCopyLang].uiText.start" class="admin-input" />
                </label>
                <label>
                  粘贴按钮
                  <input v-model="adminSiteContent[adminCopyLang].uiText.paste" class="admin-input" />
                </label>
                <label>
                  清空按钮
                  <input v-model="adminSiteContent[adminCopyLang].uiText.clear" class="admin-input" />
                </label>
                <label>
                  提取中按钮
                  <input v-model="adminSiteContent[adminCopyLang].uiText.loading" class="admin-input" />
                </label>
                <label>
                  结果小标题
                  <input v-model="adminSiteContent[adminCopyLang].uiText.resultLabel" class="admin-input" />
                </label>
                <label class="wide">
                  首页输入框提示
                  <input v-model="adminSiteContent[adminCopyLang].uiText.placeholders.auto" class="admin-input" />
                </label>
                <label>
                  视频页输入提示
                  <input v-model="adminSiteContent[adminCopyLang].uiText.placeholders.video" class="admin-input" />
                </label>
                <label>
                  文案页输入提示
                  <input v-model="adminSiteContent[adminCopyLang].uiText.placeholders.text" class="admin-input" />
                </label>
                <label>
                  图文页输入提示
                  <input v-model="adminSiteContent[adminCopyLang].uiText.placeholders.image" class="admin-input" />
                </label>
                <label>
                  文章页输入提示
                  <input v-model="adminSiteContent[adminCopyLang].uiText.placeholders.article" class="admin-input" />
                </label>
                <label>
                  进度标题
                  <input v-model="adminSiteContent[adminCopyLang].uiText.progressTitle" class="admin-input" />
                </label>
                <label>
                  识别进度
                  <input v-model="adminSiteContent[adminCopyLang].uiText.progressDetect" class="admin-input" />
                </label>
                <label>
                  提取进度
                  <input v-model="adminSiteContent[adminCopyLang].uiText.progressExtract" class="admin-input" />
                </label>
                <label>
                  转写进度
                  <input v-model="adminSiteContent[adminCopyLang].uiText.progressTranscribe" class="admin-input" />
                </label>
                <label>
                  整理进度
                  <input v-model="adminSiteContent[adminCopyLang].uiText.progressFinalize" class="admin-input" />
                </label>
                <label>
                  上传进度
                  <input v-model="adminSiteContent[adminCopyLang].uiText.progressUpload" class="admin-input" />
                </label>
                <label>
                  功能区小标题
                  <input v-model="adminSiteContent[adminCopyLang].uiText.featureEyebrow" class="admin-input" />
                </label>
                <label>
                  功能区标题
                  <input v-model="adminSiteContent[adminCopyLang].uiText.featureTitle" class="admin-input" />
                </label>
                <label>
                  步骤区标题
                  <input v-model="adminSiteContent[adminCopyLang].uiText.stepsTitle" class="admin-input" />
                </label>
                <label>
                  FAQ 标题
                  <input v-model="adminSiteContent[adminCopyLang].uiText.faqTitle" class="admin-input" />
                </label>
                <label>
                  FAQ 副标题
                  <input v-model="adminSiteContent[adminCopyLang].uiText.faqSubtitle" class="admin-input" />
                </label>
                <label>
                  Footer 简介
                  <input v-model="adminSiteContent[adminCopyLang].uiText.footerDesc" class="admin-input" />
                </label>
                <label>
                  Footer 核心功能
                  <input v-model="adminSiteContent[adminCopyLang].uiText.core" class="admin-input" />
                </label>
                <label>
                  Footer 热门工具
                  <input v-model="adminSiteContent[adminCopyLang].uiText.hot" class="admin-input" />
                </label>
                <label>
                  Footer 基础信息
                  <input v-model="adminSiteContent[adminCopyLang].uiText.info" class="admin-input" />
                </label>
              </div>
              <div class="copy-list-block">
                <div class="admin-heading compact">
                  <h3>工具内页标题</h3>
                  <p>这里控制每个工具页的页面小标签、大标题、小字和 SEO 标题。</p>
                </div>
                <article
                  v-for="(page, path) in adminSiteContent[adminCopyLang].toolPages"
                  :key="path"
                  class="copy-page-row"
                >
                  <strong>{{ path }}</strong>
                  <input v-model="page.badge" class="admin-input" placeholder="小标签" />
                  <input v-model="page.title" class="admin-input" placeholder="页面大标题" />
                  <textarea v-model="page.subtitle" class="admin-textarea" placeholder="页面说明"></textarea>
                  <input v-model="page.seoTitle" class="admin-input" placeholder="浏览器标题 / SEO 标题" />
                </article>
              </div>
              <div class="copy-list-block">
                <div class="admin-heading compact">
                  <h3>功能卡片</h3>
                  <button class="secondary-button" type="button" @click="addEditableItem(adminSiteContent[adminCopyLang].featureCards, { title: '', text: '' })">新增</button>
                </div>
                <article v-for="(card, index) in adminSiteContent[adminCopyLang].featureCards" :key="`card-${index}`" class="copy-row">
                  <input v-model="card.title" class="admin-input" placeholder="标题" />
                  <input v-model="card.text" class="admin-input" placeholder="说明" />
                  <button class="secondary-button" type="button" @click="removeEditableItem(adminSiteContent[adminCopyLang].featureCards, index)">删除</button>
                </article>
              </div>
              <div class="copy-list-block">
                <div class="admin-heading compact">
                  <h3>使用步骤</h3>
                  <button class="secondary-button" type="button" @click="addEditableItem(adminSiteContent[adminCopyLang].steps, { title: '', text: '' })">新增</button>
                </div>
                <article v-for="(step, index) in adminSiteContent[adminCopyLang].steps" :key="`step-${index}`" class="copy-row">
                  <input v-model="step.title" class="admin-input" placeholder="步骤标题" />
                  <input v-model="step.text" class="admin-input" placeholder="步骤说明" />
                  <button class="secondary-button" type="button" @click="removeEditableItem(adminSiteContent[adminCopyLang].steps, index)">删除</button>
                </article>
              </div>
              <div class="copy-list-block">
                <div class="admin-heading compact">
                  <h3>常见问题</h3>
                  <button class="secondary-button" type="button" @click="addEditableItem(adminSiteContent[adminCopyLang].faqs, { question: '', answer: '' })">新增</button>
                </div>
                <article v-for="(faq, index) in adminSiteContent[adminCopyLang].faqs" :key="`faq-${index}`" class="copy-row faq-copy-row">
                  <input v-model="faq.question" class="admin-input" placeholder="问题" />
                  <textarea v-model="faq.answer" class="admin-textarea" placeholder="答案"></textarea>
                  <button class="secondary-button" type="button" @click="removeEditableItem(adminSiteContent[adminCopyLang].faqs, index)">删除</button>
                </article>
              </div>
            </div>
            <article v-for="user in adminUsers" :key="user.id" class="admin-user-row">
              <div>
                <strong>{{ user.email }}</strong>
                <span>{{ user.name || '未设置昵称' }}</span>
              </div>
              <select v-model="user.plan" class="admin-select">
                <option value="free">free</option>
                <option value="monthly">monthly</option>
                <option value="yearly">yearly</option>
                <option value="lifetime">lifetime</option>
                <option value="pro">pro</option>
                <option value="admin">admin</option>
              </select>
              <input v-model.number="user.credits" class="admin-credit" type="number" min="0" max="100000" />
              <button class="secondary-button" :disabled="adminLoading" @click="saveAdminUser(user)">保存</button>
            </article>
          </div>
          <button class="secondary-button auth-submit" @click="logout">退出登录</button>
        </div>
      </section>
    </div>

    <main>
      <section v-if="isProfitPage" class="profit-page">
        <div class="profit-hero">
          <div class="profit-hero-copy">
            <p class="eyebrow"><Calculator :size="18" /> ROI</p>
            <h1>电商 ROI 测算器</h1>
            <p class="subtitle">对比调价和 ROI 调整前后的单均利润、总利润和保本线。</p>
          </div>
          <div class="shared-page-actions">
            <button class="secondary-button" type="button" @click="navigate('/')">返回解析工具</button>
            <button class="secondary-button" type="button" :disabled="profitLoading" @click="loadProfitConfig">
              {{ profitLoading ? '刷新中...' : '刷新公式' }}
            </button>
          </div>
        </div>

        <p v-if="profitMessage" class="alert" :class="profitMessageType">{{ profitMessage }}</p>
        <div v-if="profitInputWarnings.length" class="profit-warning-list">
          <p v-for="warning in profitInputWarnings" :key="warning">{{ warning }}</p>
        </div>

        <div class="profit-layout">
          <section class="profit-panel">
            <div class="profit-panel-head">
              <div>
                <span>基础参数</span>
                <h2>按真实经营口径填数</h2>
              </div>
            </div>
            <div class="profit-form-grid">
              <label>
                <span title="平台产生的下单笔数，包含后续发货前退货和发货后退货的订单。">下单量</span>
                <input v-model.number="profitForm.orderCount" type="number" min="0" step="1" />
              </label>
              <label>
                <span title="当前广告后台看到的 ROI，通常等于销售GMV除以广告花费。">当前广告 ROI</span>
                <input v-model.number="profitForm.roi" type="number" min="0.01" step="0.01" />
              </label>
              <label>
                <span title="假设优化投放后能达到的广告 ROI，用来测算利润变化。">调整后广告 ROI</span>
                <input v-model.number="profitForm.adjustedRoi" type="number" min="0.01" step="0.01" />
              </label>
              <label>
                <span title="还没发货就取消或退款的订单比例，这部分不产生货款成本和运费险。">发货前退货率 (%)</span>
                <input v-model.number="profitForm.preShipReturnRatePercent" type="number" min="0" max="99" step="0.1" />
              </label>
              <label>
                <span title="发货后又退货的订单比例，这部分会产生运费险，但货款成本按最终成交单计算。">发货后退货率 (%)</span>
                <input v-model.number="profitForm.postShipReturnRatePercent" type="number" min="0" max="99" step="0.1" />
              </label>
              <label>
                <span title="发货前退货率加发货后退货率，用来计算最终有效成交GMV。">总退货率 (%)</span>
                <input :value="formatNumber(totalReturnRatePercent, 1)" type="text" readonly />
              </label>
              <label>
                <span title="最终成交订单平均每单需要支付给工厂的货款。">单均货款成本</span>
                <input v-model.number="profitForm.productCost" type="number" min="0" step="0.01" />
              </label>
              <label>
                <span title="每个已发货订单需要扣的运费险，发货前退货不扣。">单均运费险</span>
                <input v-model.number="profitForm.shippingInsurance" type="number" min="0" step="0.01" />
              </label>
              <label>
                <span title="平台提现或结算时按提现前余额扣走的技术服务费比例。">平台服务费 (%)</span>
                <input v-model.number="profitForm.platformFeePercent" type="number" min="0" max="100" step="0.1" />
              </label>
            </div>

            <div class="profit-price-grid">
              <article>
                <strong>当前方案</strong>
                <label>
                  <span title="当前实际销售GMV，也就是平台产生的下单成交金额，未扣退货和各类成本。">当前销售GMV</span>
                  <input v-model.number="profitForm.currentGrossGmv" type="number" min="0" step="0.01" />
                </label>
                <em>客单价 {{ formatMoney(profitCurrentPrice) }} · ROI {{ formatNumber(profitForm.roi, 2) }}</em>
              </article>
              <article>
                <strong>调整后方案</strong>
                <label>
                  <span title="调整价格或销量预估后产生的销售GMV，用来反推调整后的客单价。">调整后销售GMV</span>
                  <input v-model.number="profitForm.adjustedGrossGmv" type="number" min="0" step="0.01" />
                </label>
                <em>客单价 {{ formatMoney(profitAdjustedPrice) }} · ROI {{ formatNumber(profitForm.adjustedRoi, 2) }}</em>
              </article>
            </div>
          </section>

          <section class="profit-panel profit-summary-panel">
            <div class="profit-panel-head">
              <div>
                <span>测算结果</span>
                <h2>调价和 ROI 调整后的变化</h2>
              </div>
            </div>
            <div class="profit-summary-grid">
              <article>
                <span>客单价提升</span>
                <strong>{{ formatMoney(profitDelta.price) }}</strong>
              </article>
              <article>
                <span>ROI 提升</span>
                <strong>{{ formatNumber(profitDelta.roi, 2) }}</strong>
              </article>
              <article>
                <span class="formula-label" :title="profitFormulaTitle('profitPerOrder')" @dblclick="openProfitFormulaEditor('profitPerOrder')">下单单均利润增加</span>
                <strong>{{ formatMoney(profitDelta.profitPerOrder) }}</strong>
              </article>
              <article>
                <span class="formula-label" :title="profitFormulaTitle('profit')" @dblclick="openProfitFormulaEditor('profit')">总利润增加</span>
                <strong>{{ formatMoney(profitDelta.profit) }}</strong>
              </article>
              <article>
                <span class="formula-label" :title="profitFormulaTitle('actualGrossMarginRate')" @dblclick="openProfitFormulaEditor('actualGrossMarginRate')">当前实际毛利率</span>
                <strong>{{ formatPercent(profitCurrent.values.actualGrossMarginRate) }}</strong>
              </article>
              <article>
                <span class="formula-label" :title="profitFormulaTitle('breakEvenRoi')" @dblclick="openProfitFormulaEditor('breakEvenRoi')">广告口径保本 ROI</span>
                <strong>{{ formatNumber(currentBreakEvenRoi, 2) }}</strong>
              </article>
              <article>
                <span class="formula-label" :title="profitFormulaTitle('collectionBreakEvenRoi')" @dblclick="openProfitFormulaEditor('collectionBreakEvenRoi')">回款口径保本 ROI</span>
                <strong>{{ formatNumber(currentCollectionBreakEvenRoi, 2) }}</strong>
              </article>
            </div>

            <div class="profit-compare">
              <article>
                <h3>当前</h3>
                <p><span>客单价 / ROI</span><strong>{{ formatMoney(profitCurrentPrice) }} / {{ formatNumber(profitForm.roi, 2) }}</strong></p>
                <p>
                  <span class="formula-label" :title="profitFormulaTitle('actualGrossMarginRate')" @dblclick="openProfitFormulaEditor('actualGrossMarginRate')">实际毛利率</span>
                  <strong>{{ formatPercent(profitCurrent.values.actualGrossMarginRate) }}</strong>
                </p>
                <p>
                  <span class="formula-label" :title="profitFormulaTitle('breakEvenRoi')" @dblclick="openProfitFormulaEditor('breakEvenRoi')">广告口径保本 ROI</span>
                  <strong>
                    {{ formatNumber(currentBreakEvenRoi, 2) }}
                    <em :class="breakEvenStatus(profitForm.roi, currentBreakEvenRoi).className">{{ breakEvenStatus(profitForm.roi, currentBreakEvenRoi).text }}</em>
                  </strong>
                </p>
                <p><span class="formula-label" :title="profitFormulaTitle('collectionBreakEvenRoi')" @dblclick="openProfitFormulaEditor('collectionBreakEvenRoi')">回款口径保本 ROI</span><strong>{{ formatNumber(currentCollectionBreakEvenRoi, 2) }}</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('profit')" @dblclick="openProfitFormulaEditor('profit')">总利润</span><strong>{{ formatMoney(profitCurrent.values.profit) }}</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('profitPerOrder')" @dblclick="openProfitFormulaEditor('profitPerOrder')">下单单均利润</span><strong>{{ formatMoney(profitCurrent.values.profitPerOrder) }}</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('settledOrders')" @dblclick="openProfitFormulaEditor('settledOrders')">有效成交单量</span><strong>{{ formatNumber(profitCurrent.values.settledOrders, 0) }} 单</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('adCost')" @dblclick="openProfitFormulaEditor('adCost')">广告费</span><strong>{{ formatMoney(profitCurrent.values.adCost) }}</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('shippedOrders')" @dblclick="openProfitFormulaEditor('shippedOrders')">已发货单量</span><strong>{{ formatNumber(profitCurrent.values.shippedOrders, 0) }} 单</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('insuranceTotal')" @dblclick="openProfitFormulaEditor('insuranceTotal')">运费险</span><strong>{{ formatMoney(profitCurrent.values.insuranceTotal) }}</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('withdrawBase')" @dblclick="openProfitFormulaEditor('withdrawBase')">提现前余额</span><strong>{{ formatMoney(profitCurrent.values.withdrawBase) }}</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('platformFee')" @dblclick="openProfitFormulaEditor('platformFee')">平台服务费</span><strong>{{ formatMoney(profitCurrent.values.platformFee) }}</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('productCostTotal')" @dblclick="openProfitFormulaEditor('productCostTotal')">货款成本</span><strong>{{ formatMoney(profitCurrent.values.productCostTotal) }}</strong></p>
              </article>
              <article>
                <h3>调整后</h3>
                <p><span>客单价 / ROI</span><strong>{{ formatMoney(profitAdjustedPrice) }} / {{ formatNumber(profitForm.adjustedRoi, 2) }}</strong></p>
                <p>
                  <span class="formula-label" :title="profitFormulaTitle('actualGrossMarginRate')" @dblclick="openProfitFormulaEditor('actualGrossMarginRate')">实际毛利率</span>
                  <strong>{{ formatPercent(profitAdjusted.values.actualGrossMarginRate) }}</strong>
                </p>
                <p>
                  <span class="formula-label" :title="profitFormulaTitle('breakEvenRoi')" @dblclick="openProfitFormulaEditor('breakEvenRoi')">广告口径保本 ROI</span>
                  <strong>
                    {{ formatNumber(adjustedBreakEvenRoi, 2) }}
                    <em :class="breakEvenStatus(profitForm.adjustedRoi, adjustedBreakEvenRoi).className">{{ breakEvenStatus(profitForm.adjustedRoi, adjustedBreakEvenRoi).text }}</em>
                  </strong>
                </p>
                <p><span class="formula-label" :title="profitFormulaTitle('collectionBreakEvenRoi')" @dblclick="openProfitFormulaEditor('collectionBreakEvenRoi')">回款口径保本 ROI</span><strong>{{ formatNumber(adjustedCollectionBreakEvenRoi, 2) }}</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('profit')" @dblclick="openProfitFormulaEditor('profit')">总利润</span><strong>{{ formatMoney(profitAdjusted.values.profit) }}</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('profitPerOrder')" @dblclick="openProfitFormulaEditor('profitPerOrder')">下单单均利润</span><strong>{{ formatMoney(profitAdjusted.values.profitPerOrder) }}</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('settledOrders')" @dblclick="openProfitFormulaEditor('settledOrders')">有效成交单量</span><strong>{{ formatNumber(profitAdjusted.values.settledOrders, 0) }} 单</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('adCost')" @dblclick="openProfitFormulaEditor('adCost')">广告费</span><strong>{{ formatMoney(profitAdjusted.values.adCost) }}</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('shippedOrders')" @dblclick="openProfitFormulaEditor('shippedOrders')">已发货单量</span><strong>{{ formatNumber(profitAdjusted.values.shippedOrders, 0) }} 单</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('insuranceTotal')" @dblclick="openProfitFormulaEditor('insuranceTotal')">运费险</span><strong>{{ formatMoney(profitAdjusted.values.insuranceTotal) }}</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('withdrawBase')" @dblclick="openProfitFormulaEditor('withdrawBase')">提现前余额</span><strong>{{ formatMoney(profitAdjusted.values.withdrawBase) }}</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('platformFee')" @dblclick="openProfitFormulaEditor('platformFee')">平台服务费</span><strong>{{ formatMoney(profitAdjusted.values.platformFee) }}</strong></p>
                <p><span class="formula-label" :title="profitFormulaTitle('productCostTotal')" @dblclick="openProfitFormulaEditor('productCostTotal')">货款成本</span><strong>{{ formatMoney(profitAdjusted.values.productCostTotal) }}</strong></p>
              </article>
            </div>

            <div class="profit-detail-table">
              <div>
                <span>指标</span>
                <span>当前</span>
                <span>调整后</span>
              </div>
              <div v-for="meta in profitFormulaMeta" :key="meta.key">
                <span class="formula-label" :title="profitFormulaTitle(meta.key)" @dblclick="openProfitFormulaEditor(meta.key)">{{ meta.label }}</span>
                <span>{{ formatProfitMetric(meta.key, profitCurrent.values[meta.key]) }}</span>
                <span>{{ formatProfitMetric(meta.key, profitAdjusted.values[meta.key]) }}</span>
              </div>
            </div>
          </section>
        </div>

        <section class="profit-panel profit-config-panel">
          <button type="button" class="profit-config-toggle" @click="profitConfigOpen = !profitConfigOpen">
            <SlidersHorizontal :size="18" />
            <span>公式配置</span>
            <ChevronUp v-if="profitConfigOpen" :size="18" />
            <ChevronDown v-else :size="18" />
          </button>
          <div v-if="profitConfigOpen" class="profit-config-body">
            <p class="profit-config-note">
              可用变量：
              <em v-for="([name, label]) in profitVariableLabels" :key="name">{{ name }}={{ label }}</em>
            </p>
            <div class="profit-formula-grid">
              <label v-for="meta in profitFormulaMeta" :key="meta.key">
                <span>{{ meta.label }}</span>
                <input v-model="profitConfig.formulas[meta.key]" type="text" />
                <small>{{ meta.hint }}</small>
              </label>
            </div>
            <div class="button-row profit-config-actions">
              <button class="primary-button" type="button" :disabled="profitLoading || !profitStorageConfigured" @click="saveProfitConfig">
                <Loader2 v-if="profitLoading" class="spin" :size="18" />
                <Save v-else :size="18" />
                保存公式
              </button>
              <button class="secondary-button" type="button" :disabled="profitLoading || !profitStorageConfigured" @click="resetProfitConfig">
                <RotateCcw :size="18" />
                恢复默认
              </button>
            </div>
          </div>
        </section>
      </section>

      <section v-else-if="isSharedListPage" class="shared-page">
        <div class="shared-page-head shared-list-head">
          <div class="shared-page-title">
            <Share2 :size="22" />
            <h1>共享素材</h1>
          </div>
          <div class="shared-page-actions">
            <button class="primary-button" type="button" @click="navigate('/')">去解析新视频</button>
            <button class="secondary-button" type="button" :disabled="sharedLoading" @click="loadSharedVideos">
              {{ sharedLoading ? '刷新中...' : '刷新列表' }}
            </button>
          </div>
        </div>

        <p v-if="sharedError" class="alert error">{{ sharedError }}</p>
        <div v-if="sharedLoading && !sharedVideos.length" class="shared-empty">
          <Loader2 class="spin" :size="24" />
          <span>正在读取共享视频...</span>
        </div>
        <div v-else-if="sharedVideos.length" class="shared-grid">
          <article v-for="item in sharedVideos" :key="item.id" class="shared-card" :class="{ unread: isSharedVideoUnread(item.id) }">
            <button type="button" class="shared-card-cover" @click="navigate(`/share/${item.id}`)">
              <span v-if="isSharedVideoUnread(item.id)" class="shared-card-new">未读</span>
              <img v-if="item.cover" :src="item.cover" :alt="item.title" loading="lazy" referrerpolicy="no-referrer" />
              <span v-else class="shared-cover-empty">
                <FileVideo :size="34" />
                <em>暂无封面</em>
              </span>
            </button>
            <div class="shared-card-body">
              <strong>{{ item.title }}</strong>
              <div class="shared-card-actions">
                <button type="button" class="secondary-button" @click="navigate(`/share/${item.id}`)">打开查看</button>
                <button
                  type="button"
                  class="secondary-button shared-delete-button"
                  :disabled="sharedLoading"
                  @click="deleteSharedVideoItem(item)"
                  title="删除共享素材"
                  aria-label="删除共享素材"
                >
                  <Trash2 :size="17" />
                </button>
              </div>
            </div>
          </article>
        </div>
        <p v-else class="shared-empty">还没有共享视频。解析成功后点击“分享给同事”就会出现在这里。</p>
      </section>

      <section v-else-if="isShareDetailPage" class="shared-page shared-detail-hero">
        <div class="shared-page-head shared-detail-head">
          <p class="eyebrow"><Share2 :size="18" /> 共享视频</p>
          <h1>{{ currentSharedRecord?.title || resultTitle || '共享视频' }}</h1>
          <p class="subtitle">
            {{ currentSharedRecord?.description || '这个视频由同事共享，可直接预览；如果还没有逐字稿，可以在下方手动提取。' }}
          </p>
          <div class="shared-page-actions">
            <button class="secondary-button" type="button" @click="navigate('/shared')">返回共享池</button>
            <button class="secondary-button" type="button" @click="copyText(currentShareUrl)">复制当前链接</button>
            <button
              v-if="currentSharedRecord"
              class="secondary-button shared-delete-button"
              type="button"
              :disabled="sharedLoading"
              @click="deleteSharedVideoItem(currentSharedRecord)"
            >
              <Trash2 :size="17" />
              删除记录
            </button>
          </div>
          <p v-if="sharedLoading" class="alert info">正在读取共享视频...</p>
          <p v-if="sharedError" class="alert error">{{ sharedError }}</p>
          <p v-if="sharedMessage" class="alert success">{{ sharedMessage }}</p>
        </div>
      </section>

      <section v-else-if="isLegalPage" class="legal-hero">
        <p class="eyebrow">{{ toolPage.badge }}</p>
        <h1>{{ toolPage.title }}</h1>
        <p class="subtitle">{{ toolPage.subtitle }}</p>
        <div class="legal-list">
          <article v-for="([title, text]) in legalContent" :key="title">
            <h2>{{ title }}</h2>
            <p>{{ text }}</p>
          </article>
        </div>
      </section>

      <section v-else class="hero">
        <p v-if="toolPage?.badge" class="eyebrow">
          <component
            :is="
              toolPage?.type === 'image'
                ? Image
                : toolPage?.type === 'text'
                  ? Captions
                  : toolPage?.type === 'media-file'
                    ? FileAudio
                    : FileVideo
            "
            :size="18"
          />
          {{ toolPage.badge }}
        </p>
        <h1>{{ toolPage?.title || uiText.heroTitle }}</h1>
        <p class="subtitle">
          {{ toolPage?.subtitle || uiText.heroSubtitle }}
        </p>

        <div v-if="toolPage?.type === 'text'" class="mode-switch">
          <button :class="{ active: textMode === 'link' }" @click="textMode = 'link'">
            <Link :size="17" /> {{ uiText.linkText }}
          </button>
          <button :class="{ active: textMode === 'file' }" @click="textMode = 'file'">
            <FileAudio :size="17" /> {{ uiText.localText }}
          </button>
        </div>

        <section v-if="isLinkInputPage" class="extract-box" aria-label="链接提取">
          <textarea
            v-model="url"
            ref="urlInput"
            rows="1"
            :placeholder="
              isHome
                ? uiText.placeholders.auto
                : toolPage?.type === 'video'
                ? uiText.placeholders.video
                : toolPage?.type === 'image'
                  ? uiText.placeholders.image
                  : toolPage?.type === 'article'
                    ? uiText.placeholders.article
                    : uiText.placeholders.text
            "
            @input="autoResizeTextarea"
          />
          <div class="button-row">
            <button class="primary-button" :disabled="loading" @click="extract">
              <Loader2 v-if="loading" class="spin" :size="18" />
              <Link v-else :size="18" />
              {{ loading ? uiText.loading : uiText.start }}
            </button>
            <button class="secondary-button" @click="paste"><Clipboard :size="18" /> {{ uiText.paste }}</button>
            <button class="secondary-button" @click="clearInput">{{ uiText.clear }}</button>
            <button
              type="button"
              class="secondary-button top-history-button"
              title="最近提取记录"
              aria-label="最近提取记录"
              @click="transcriptHistoryOpen = true"
            >
              <History :size="18" />
              <span>记录</span>
              <em>{{ transcriptHistory.length }}</em>
            </button>
            <button
              type="button"
              class="secondary-button top-config-button"
              title="系统配置"
              aria-label="系统配置"
              @click="openSystemConfig"
            >
              <Settings :size="18" />
              <span>配置</span>
            </button>
            <button
              type="button"
              class="secondary-button top-shared-button"
              title="共享视频池"
              aria-label="共享视频池"
              @click="navigate('/shared')"
            >
              <Share2 :size="18" />
              <span>共享</span>
              <em v-if="unreadSharedCount" class="shared-unread-badge">{{ unreadSharedCount > 99 ? '99+' : unreadSharedCount }}</em>
            </button>
            <button
              type="button"
              class="secondary-button top-profit-button"
              title="ROI"
              aria-label="ROI"
              @click="navigate('/profit')"
            >
              <Calculator :size="18" />
              <span>ROI</span>
            </button>
          </div>
          <p v-if="error && !videoTranscriptLoading" class="alert error">{{ error }}</p>
          <p v-if="notice && !videoTranscriptLoading" class="alert success">{{ notice }}</p>
        </section>

        <section v-else class="upload-extract-box" aria-label="文件上传提取">
          <div class="file-type-switch" aria-label="文件类型">
            <button :class="{ active: fileMode === 'video' }" @click="fileMode = 'video'">
              <FileVideo :size="17" /> 视频文件
            </button>
            <button :class="{ active: fileMode === 'audio' }" @click="fileMode = 'audio'">
              <FileAudio :size="17" /> 音频文件
            </button>
          </div>
          <label class="upload-drop">
            <input :accept="fileAccept" type="file" @change="onFileChange" />
            <span class="upload-icon">
              <Upload :size="30" />
            </span>
            <strong>{{ selectedFile?.name || fileLabel }}</strong>
            <small>
              {{ fileMode === 'audio' ? '支持 MP3、M4A、WAV 等音频文件' : '支持 MP4、MOV、M4V 等视频文件' }}
            </small>
            <small>免费版转文字限制 5 分钟以内</small>
          </label>
          <div class="button-row">
            <button class="primary-button" :disabled="loading || !selectedFile" @click="transcribeFile">
              <Loader2 v-if="loading" class="spin" :size="18" />
              <Upload v-else :size="18" />
              {{ loading ? '转写中...' : '上传并提取文案' }}
            </button>
          </div>
          <p class="alert info">
            {{ toolPage?.type === 'text'
              ? '上传本地视频或音频，自动识别里面的语音内容并整理成文字。'
              : '上传本地视频或音频，自动提取可复制的文字稿。' }}
          </p>
        </section>

        <!-- 功能标签已隐藏，保持主界面简洁 -->
        <!--
        <div v-if="isHome" class="home-type-tags">
          <button @click="navigate('/video')"><FileVideo :size="17" /> {{ uiText.nav[1] }}</button>
          <button @click="navigate('/text')"><Captions :size="17" /> {{ uiText.nav[2] }}</button>
          <button @click="navigate('/image-text')"><Image :size="17" /> {{ uiText.nav[3] }}</button>
          <button @click="navigate('/article')"><FileText :size="17" /> {{ uiText.nav[4] }}</button>
        </div>
        -->

        <!--
        <div v-if="activeSeoPage?.keywords?.length" class="keyword-strip">
          <span v-for="keyword in activeSeoPage.keywords" :key="keyword">{{ keyword }}</span>
        </div>
        -->
      </section>

      <section v-if="loading && extractProgress" id="extract-progress" class="result-section progress-section" aria-live="polite">
        <div class="progress-card">
          <div class="section-title center">
            <h2>{{ uiText.resultLabel }}</h2>
          </div>
          <div class="progress-panel">
            <Loader2 class="spin progress-icon" :size="26" />
            <div class="progress-copy">
              <strong>{{ extractProgress.title }}</strong>
              <span>{{ extractProgress.detail }}</span>
            </div>
            <div class="progress-track">
              <span :style="{ width: `${extractProgress.percent}%` }"></span>
            </div>
          </div>
        </div>
      </section>

      <section v-if="hasResultContent" id="extract-result" class="result-section">
        <div class="result-card">
          <div class="section-title">
            <div>
              <p class="eyebrow">{{ uiText.resultLabel }}</p>
              <h2>{{ resultHeading }}</h2>
            </div>
            <button class="icon-button" title="复制文案" @click="copyText"><Copy :size="18" /></button>
          </div>

          <div class="result-layout">
            <article class="result-block">
              <span>作品标题</span>
              <p>{{ resultTitle || '未识别到独立标题' }}</p>
            </article>

            <div v-if="toolPage?.type === 'article'" class="article-mode-switch">
              <button :class="{ active: articleView === 'text' }" @click="articleView = 'text'">整理正文</button>
              <button :class="{ active: articleView === 'layout' }" @click="articleView = 'layout'">二创排版</button>
              <select v-model="articleTemplate" class="article-template-select" @change="applyArticleTemplate">
                <option v-for="template in articleTemplates" :key="template.id" :value="template.id">
                  {{ template.name }}
                </option>
              </select>
              <button :disabled="articleRewriteLoading || !resultText" @click="rewriteArticle">
                {{ articleRewriteLoading ? 'AI 二创中...' : 'AI 二创并排版' }}
              </button>
              <button :disabled="!articleCopyHtml" @click="copyArticleHtml">复制公众号格式</button>
            </div>

            <article v-if="shouldShowMainTextBlock && (toolPage?.type !== 'article' || articleView === 'text')" class="result-block">
              <span>{{ copyBlockTitle }}</span>
              <p v-if="resultText && articleView === 'text'" class="result-text">{{ resultText }}</p>
              <p v-else>未识别到文案</p>
            </article>

            <section v-else-if="toolPage?.type === 'article' && articleView === 'layout'" class="article-studio">
              <article class="article-source-panel">
                <span>原文结构</span>
                <div v-if="articleBlocks.length" class="article-source-list">
                  <template v-for="(block, index) in articleBlocks" :key="`${block.type}-${index}`">
                    <p v-if="block.type === 'heading'" class="source-heading">{{ block.text }}</p>
                    <p v-else-if="block.type === 'text'">{{ block.text }}</p>
                    <figure v-else-if="block.type === 'image'">
                      <img :src="block.src" :alt="`文章图片 ${index + 1}`" loading="lazy" referrerpolicy="no-referrer" />
                      <figcaption>图片 {{ index + 1 }}</figcaption>
                    </figure>
                  </template>
                </div>
                <p v-else>未识别到可排版内容</p>
              </article>

              <article class="article-editor-panel">
                <div class="article-editor-head">
                  <span>公众号成品稿</span>
                  <small>可直接改字、删段落、调整图片位置，完成后复制到公众号后台。</small>
                </div>
                <div
                  class="article-rich-editor"
                  contenteditable="true"
                  spellcheck="false"
                  :data-placeholder="articleRewriteLoading ? 'AI 正在生成公众号稿...' : '点击 AI 二创，或直接在这里编辑排版稿'"
                  v-html="articleCopyHtml"
                  @input="syncArticleDraft"
                ></div>
              </article>
            </section>

            <article v-if="shouldShowPublishedText" class="result-block">
              <span>平台发布文案</span>
              <p class="result-text">{{ publishedText }}</p>
            </article>

            <article class="result-block">
              <span>Tag / 话题标签</span>
              <div v-if="tags.length" class="tag-list">
                <button v-for="tag in tags" :key="tag" @click="copyText(tag)">{{ tag }}</button>
              </div>
              <p v-else>未识别到标签</p>
            </article>

            <article v-if="shouldShowVideoResult" class="result-block video-preview-block">
              <span>视频提取 / 去水印</span>
              <div v-if="videoLinks.length" class="video-result">
                <video :src="previewVideoUrl" controls playsinline preload="metadata"></video>
                <div class="video-actions">
                  <a :href="previewVideoUrl" download="video.mp4">下载视频</a>
                  <button class="video-transcript-action" :disabled="videoTranscriptLoading" @click="transcribeExtractedVideo('precise')">
                    <Loader2 v-if="videoTranscriptLoading && transcriptMode === 'precise'" class="spin" :size="15" />
                    <Captions v-else :size="17" />
                    {{ videoTranscriptLoading && transcriptMode === 'precise' ? '提取中...' : '提取逐字稿' }}
                  </button>
                  <button
                    v-if="!isShareDetailPage"
                    class="video-share-action"
                    :disabled="shareLoading"
                    @click="shareCurrentVideo"
                  >
                    <Loader2 v-if="shareLoading" class="spin" :size="15" />
                    <Share2 v-else :size="17" />
                    {{ shareLoading ? '共享中...' : '分享给同事' }}
                  </button>
                </div>
                <p v-if="sharedMessage && !isShareDetailPage" class="shared-inline-message">{{ sharedMessage }}</p>
                <div v-if="videoLinks.length > 1" class="media-links">
                  <a v-for="(link, index) in videoLinks.slice(1)" :key="link" :href="link" download target="_blank" rel="noreferrer">
                    备用源 {{ index + 2 }}
                  </a>
                </div>
              </div>
              <p v-else>未返回视频链接</p>
            </article>

            <article v-if="shouldShowImageResult" class="result-block">
              <span>图片素材</span>
              <div class="image-grid">
                <div v-for="(link, index) in imageLinks" :key="link" class="image-card">
                  <a :href="link" target="_blank" rel="noreferrer">
                    <img :src="link" :alt="`图片素材 ${index + 1}`" loading="lazy" referrerpolicy="no-referrer" />
                  </a>
                  <div class="image-actions">
                    <a :href="link" target="_blank" rel="noreferrer">打开</a>
                    <a :href="`/api/image-proxy?url=${encodeURIComponent(link)}&index=${index + 1}`">下载原图</a>
                    <button @click="copyText(link)">复制链接</button>
                  </div>
                </div>
              </div>
            </article>

            <article v-if="shouldShowVideoTextUnderPreview" id="video-transcript-result" class="result-block video-transcript-panel">
              <div class="video-transcript-head">
                <div class="video-transcript-title">
                  <span>{{ copyBlockTitle }}</span>
                  <em>{{ resultText.length }} 字</em>
                </div>
                <div class="video-transcript-tools">
                  <button type="button" class="transcript-history-trigger" @click="transcriptHistoryOpen = true">
                    <History :size="17" />
                    <span>最近提取记录</span>
                    <em>{{ transcriptHistory.length }}</em>
                  </button>
                  <button
                    type="button"
                    :class="['transcript-copy-trigger', { copied: transcriptCopyDone }]"
                    @click="copyText(resultText, { feedback: 'transcript' })"
                  >
                    <Check v-if="transcriptCopyDone" :size="17" />
                    <Copy v-else :size="17" />
                    <span>{{ transcriptCopyDone ? '复制成功' : '一键复制文案' }}</span>
                  </button>
                </div>
              </div>
              <p class="result-text">{{ resultText }}</p>
            </article>

            <article v-if="videoTranscriptLoading && shouldShowVideoResult" id="video-transcript-progress" class="result-block video-transcript-panel">
              <span>正在提取逐字稿</span>
              <div class="transcript-progress-list" aria-live="polite">
                <div
                  v-for="item in transcriptStageItems"
                  :key="item.stage"
                  :class="['transcript-progress-step', { active: item.active, done: item.done }]"
                >
                  <span class="transcript-progress-dot">
                    <Check v-if="item.done" :size="13" />
                    <Loader2 v-else-if="item.active" class="spin" :size="13" />
                  </span>
                  <strong>{{ item.label }}</strong>
                </div>
              </div>
              <p class="result-text transcript-progress-message">{{ transcriptProgress.message || notice }}</p>
              <p v-if="transcriptLiveText" class="transcript-live-text">
                已识别 {{ transcriptLiveText.length }} 字
              </p>
            </article>

            <article v-if="error && !videoTranscriptLoading && shouldShowVideoResult" class="result-block video-transcript-panel">
              <span>提取失败</span>
              <p class="result-text" style="color: #be123c;">{{ error }}</p>
            </article>
          </div>
        </div>
      </section>

      <section v-if="!isLegalPage && !isHome && !isSharedPage && !isProfitPage" id="features" class="section">
        <div class="section-title center">
          <p class="eyebrow"><Sparkles :size="18" /> {{ uiText.featureEyebrow }}</p>
          <h2>{{ uiText.featureTitle }}</h2>
        </div>
        <div class="feature-grid">
          <article v-for="card in featureCards" :key="card.title">
            <component :is="card.icon" :size="30" />
            <h3>{{ card.title }}</h3>
            <p>{{ card.text }}</p>
          </article>
        </div>
      </section>

      <section v-if="!isLegalPage && !isHome && !isSharedPage && !isProfitPage" id="steps" class="section steps-section">
        <div class="section-title center">
          <p class="eyebrow"><Check :size="18" /> {{ uiText.stepsEyebrow }}</p>
          <h2>{{ uiText.stepsTitle }}</h2>
        </div>
        <div class="steps-grid">
          <article v-for="([title, text], index) in steps" :key="title">
            <span>{{ index + 1 }}</span>
            <h3>{{ title }}</h3>
            <p>{{ text }}</p>
          </article>
        </div>
      </section>

      <section v-if="!isLegalPage && !isHome && !isSharedPage && !isProfitPage" id="faq" class="section">
        <div class="section-title center faq-title">
          <h2>{{ uiText.faqTitle }}</h2>
          <p>{{ uiText.faqSubtitle }}</p>
        </div>
        <div class="faq-list">
          <article
            v-for="([question, answer], index) in faqs"
            :key="question"
            :class="{ open: openFaqIndex === index }"
          >
            <button
              class="faq-question"
              type="button"
              :aria-expanded="openFaqIndex === index"
              @click="toggleFaq(index)"
            >
              <h3>{{ question }}</h3>
              <ChevronUp v-if="openFaqIndex === index" :size="21" />
              <ChevronDown v-else :size="21" />
            </button>
            <p v-if="openFaqIndex === index">{{ answer }}</p>
          </article>
        </div>
      </section>

      <section v-if="!isLegalPage && !isHome && !isSharedPage && !isProfitPage" class="section seo-section">
        <div class="section-title center">
          <p class="eyebrow"><Sparkles :size="18" /> {{ uiText.seoEyebrow }}</p>
          <h2>{{ uiText.seoTitle }}</h2>
        </div>
        <div class="seo-group-grid">
          <article v-for="group in seoToolGroups" :key="group.title" class="seo-group">
            <h3>{{ group.title }}</h3>
            <div class="seo-link-grid">
              <a v-for="[path, label] in group.links" :key="path" :href="path" @click.prevent="navigate(path)">
                {{ label }}
              </a>
            </div>
          </article>
        </div>
      </section>
    </main>

    <div v-if="profitFormulaEditorOpen" class="modal-backdrop" @click.self="closeProfitFormulaEditor">
      <section class="profit-formula-modal" role="dialog" aria-modal="true" aria-label="编辑计算公式">
        <div class="transcript-history-head">
          <div>
            <strong>{{ activeProfitFormulaMeta?.label || '计算公式' }}</strong>
            <span>双击指标可随时查看和修改对应公式</span>
          </div>
          <button type="button" class="modal-close-button" @click="closeProfitFormulaEditor">关闭</button>
        </div>

        <p v-if="activeProfitFormulaMeta?.hint" class="profit-formula-hint">{{ activeProfitFormulaMeta.hint }}</p>

        <label class="profit-formula-editor">
          <span>当前公式</span>
          <textarea v-model="profitFormulaDraft" rows="4" spellcheck="false"></textarea>
        </label>

        <div class="profit-formula-preview">
          <span>当前方案结果</span>
          <strong>
            {{ formatProfitMetric(profitFormulaEditorKey, profitCurrent.values[profitFormulaEditorKey]) }}
          </strong>
          <span>调整后结果</span>
          <strong>
            {{ formatProfitMetric(profitFormulaEditorKey, profitAdjusted.values[profitFormulaEditorKey]) }}
          </strong>
        </div>

        <p class="profit-config-note">
          可用变量：
          <em v-for="([name, label]) in profitVariableLabels" :key="name">{{ name }}={{ label }}</em>
          <em v-for="meta in profitFormulaMeta" :key="`formula-${meta.key}`">{{ meta.key }}={{ meta.label }}</em>
        </p>

        <p v-if="profitMessage && profitMessageType === 'error'" class="alert error">{{ profitMessage }}</p>

        <div class="button-row profit-config-actions">
          <button class="primary-button" type="button" :disabled="profitLoading || !profitStorageConfigured" @click="saveProfitFormulaEditor">
            <Loader2 v-if="profitLoading" class="spin" :size="18" />
            <Save v-else :size="18" />
            保存这个公式
          </button>
          <button class="secondary-button" type="button" :disabled="profitLoading" @click="resetProfitFormulaEditor">
            <RotateCcw :size="18" />
            恢复默认公式
          </button>
        </div>
      </section>
    </div>

    <div v-if="transcriptHistoryOpen" class="modal-backdrop" @click.self="transcriptHistoryOpen = false">
      <section class="transcript-history-modal" role="dialog" aria-modal="true" aria-label="最近提取记录">
        <div class="transcript-history-head">
          <div>
            <strong>最近提取记录</strong>
            <span>{{ transcriptHistory.length }} / 20</span>
          </div>
          <button type="button" class="modal-close-button" @click="transcriptHistoryOpen = false">关闭</button>
        </div>
        <div v-if="transcriptHistory.length" class="transcript-history-list">
          <article v-for="item in transcriptHistory" :key="item.id" class="transcript-history-item">
            <div>
              <strong>{{ item.title }}</strong>
              <span>{{ formatHistoryTime(item.createdAt) }} · {{ item.text.length }} 字</span>
            </div>
            <p class="transcript-history-text">{{ item.text }}</p>
            <div class="transcript-history-actions">
              <button type="button" @click="copyText(item.text)">复制</button>
              <button type="button" class="danger" @click="deleteTranscriptHistoryItem(item)">删除</button>
            </div>
          </article>
        </div>
        <p v-else class="transcript-history-empty">还没有逐字稿记录。</p>
      </section>
    </div>

    <div v-if="configOpen" class="modal-backdrop" @click.self="configOpen = false">
      <section class="system-config-modal" role="dialog" aria-modal="true" aria-label="系统配置">
        <div class="transcript-history-head">
          <div>
            <strong>视频号解析配置</strong>
            <span>手动维护腾讯元宝 Cookie</span>
          </div>
          <button type="button" class="modal-close-button" @click="configOpen = false">关闭</button>
        </div>

        <div class="config-status-grid">
          <article>
            <span>Cookie 状态</span>
            <strong>{{ wechatCookieStatus.configured ? '已配置' : '未配置' }}</strong>
          </article>
          <article>
            <span>最近更新时间</span>
            <strong>{{ wechatCookieStatus.updatedAt ? formatHistoryTime(wechatCookieStatus.updatedAt) : '暂无' }}</strong>
          </article>
          <article>
            <span>Cookie 预览</span>
            <strong>{{ wechatCookieStatus.preview || '未配置' }}</strong>
          </article>
          <article>
            <span>最近测试结果</span>
            <strong>{{ wechatCookieStatus.lastTestResult || '暂无' }}</strong>
          </article>
        </div>

        <p v-if="!wechatCookieStatus.storageConfigured" class="alert error">
          CONFIG_KV 未绑定，暂时无法保存视频号解析 Cookie。
        </p>
        <p v-else-if="!wechatCookieStatus.configured" class="alert info">
          视频号解析 Cookie 未配置，暂时无法解析微信视频号链接。
        </p>

        <label class="config-field">
          <span>腾讯元宝 Cookie</span>
          <textarea v-model="configWechatCookie" rows="5" placeholder="粘贴完整腾讯元宝 Cookie。保存后不会在页面明文展示。"></textarea>
        </label>
        <label class="config-field">
          <span>测试视频号链接（可选）</span>
          <input v-model="configTestUrl" type="text" placeholder="https://weixin.qq.com/sph/xxxx" />
        </label>

        <div class="config-actions">
          <button type="button" class="primary-button" :disabled="configLoading" @click="saveWechatCookieConfig">
            <Loader2 v-if="configLoading" class="spin" :size="17" />
            保存配置
          </button>
          <button type="button" class="secondary-button" :disabled="configLoading" @click="testWechatCookieConfig">
            测试 Cookie 是否可用
          </button>
        </div>

        <p v-if="configMessage" :class="['alert', configMessageType]">{{ configMessage }}</p>
      </section>
    </div>

    <button
      v-show="showBackToTop"
      class="back-to-top"
      :class="{ show: showBackToTop }"
      @click="scrollToTop"
      aria-label="回到顶部"
    >
      <ChevronUp :size="22" />
    </button>
  </div>
</template>
