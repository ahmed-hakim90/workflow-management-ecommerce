import type { LucideIcon } from "lucide-react";
import type { Locale } from "@/lib/i18n/config";

type MarketingBenefit = {
  title: string;
  body: string;
  icon: LucideIcon;
};

type MarketingWorkflowStep = {
  title: string;
  body: string;
};

type MarketingIntegration = {
  name: string;
  description: string;
};

type MarketingFeature = {
  title: string;
  body: string;
  icon: LucideIcon;
};

export type MarketingCopy = {
  nav: {
    platform: string;
    workflow: string;
    integrations: string;
    analytics: string;
    login: string;
    register: string;
    requestDemo: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
  };
  metrics: { label: string; value: string; detail: string }[];
  pulse: {
    eyebrow: string;
    title: string;
    live: string;
    throughput: string;
    throughputDetail: string;
    atRisk: string;
    atRiskValue: string;
    atRiskDetail: string;
    nextAction: string;
    nextActionValue: string;
    nextActionDetail: string;
  };
  platformStats: { label: string; value: string; trend: string }[];
  trust: string;
  platform: {
    eyebrow: string;
    title: string;
    description: string;
    ready: string;
    benefits: MarketingBenefit[];
  };
  workflow: {
    eyebrow: string;
    title: string;
    description: string;
    cta: string;
    steps: MarketingWorkflowStep[];
  };
  analytics: {
    eyebrow: string;
    title: string;
    confirmedOrders: string;
    deliveryHealth: string;
    openAnalytics: string;
    features: MarketingFeature[];
  };
  integrations: {
    eyebrow: string;
    title: string;
    description: string;
    items: MarketingIntegration[];
  };
  cta: {
    title: string;
    description: string;
    schedule: string;
    createAccount: string;
  };
  footer: {
    built: string;
    privacy: string;
    terms: string;
    security: string;
    apiDocs: string;
    contactSales: string;
  };
};

export const commonText: Record<Locale, Record<string, string>> = {
  en: {},
  ar: {
    "Analytics": "التحليلات",
    "Orders": "الطلبات",
    "Shipments": "الشحنات",
    "Tickets": "التذاكر",
    "Warehouse": "المخزن",
    "Users": "المستخدمون",
    "Settings": "الإعدادات",
    "System Admin": "مدير النظام",
    "Ops Manager": "مدير العمليات",
    "Confirmation": "التأكيد",
    "Invoicing": "الفواتير",
    "Support": "الدعم",
    "admin": "مدير",
    "moderator": "مشرف",
    "confirmation": "تأكيد",
    "invoicing": "فواتير",
    "warehouse": "مخزن",
    "support": "دعم",
    "User": "مستخدم",
    "Guest": "زائر",
    "alerts": "تنبيهات",
    "Mock data": "بيانات تجريبية",
    "Search tickets, IDs, or agents…": "ابحث في التذاكر أو الأرقام أو الموظفين…",
    "Search orders, tickets…": "ابحث في الطلبات أو التذاكر…",
    "Search orders, customers, or items…": "ابحث في الطلبات أو العملاء أو المنتجات…",
    "Open menu": "فتح القائمة",
    "Close menu": "إغلاق القائمة",
    "Main navigation": "التنقل الرئيسي",
    "Primary": "الرئيسية",
    "Collapse sidebar": "طي الشريط الجانبي",
    "Expand sidebar": "توسيع الشريط الجانبي",
    "Sign out": "تسجيل الخروج",
    "Search": "بحث",
    "Search (coming soon)": "البحث (قريبًا)",
    "Close search": "إغلاق البحث",
    "Calendar (coming soon)": "التقويم (قريبًا)",
    "Filters (coming soon)": "الفلاتر (قريبًا)",
    "Order notifications": "إشعارات الطلبات",
    "Sign in to view this page": "سجل الدخول لعرض هذه الصفحة",
    "Use Firebase sign-in or add a staff API key in Settings after you sign in.": "استخدم تسجيل الدخول عبر Firebase أو أضف مفتاح API للموظفين من الإعدادات بعد تسجيل الدخول.",
    "Go to login": "الذهاب لتسجيل الدخول",
    "Open settings": "فتح الإعدادات",
    "Profile": "الملف الشخصي",
    "Team": "الفريق",
    "API keys": "مفاتيح API",
    "Notifications": "الإشعارات",
    "Billing": "الفوترة",
    "Workspace": "مساحة العمل",
    "Profile information": "بيانات الملف الشخصي",
    "Saving…": "جار الحفظ…",
    "Save Changes": "حفظ التغييرات",
    "Profile saved.": "تم حفظ الملف الشخصي.",
    "Could not save profile. Try again.": "تعذر حفظ الملف الشخصي. حاول مرة أخرى.",
    "First name": "الاسم الأول",
    "Last name": "اسم العائلة",
    "Public bio": "نبذة عامة",
    "Timezone": "المنطقة الزمنية",
    "Preferred language": "اللغة المفضلة",
    "English (US)": "الإنجليزية",
    "Arabic": "العربية",
    "Danger zone": "منطقة الخطر",
    "Irreversible actions that affect your entire account access.": "إجراءات لا يمكن التراجع عنها وتؤثر على وصول الحساب بالكامل.",
    "Theme": "المظهر",
    "General": "عام",
    "Shipment rules": "قواعد الشحن",
    "Status webhooks": "ويب هوكس الحالة",
    "Kanban JSON": "Kanban JSON",
    "Developer session": "جلسة المطور",
    "Loading": "جار التحميل",
    "Loading…": "جار التحميل…",
    "Refresh": "تحديث",
    "Retry": "إعادة المحاولة",
    "Save": "حفظ",
    "Cancel": "إلغاء",
    "Delete": "حذف",
    "Edit": "تعديل",
    "Create": "إنشاء",
    "Update": "تحديث",
    "Status": "الحالة",
    "Customer": "العميل",
    "Total": "الإجمالي",
    "Date": "التاريخ",
    "Actions": "الإجراءات",
    "Role": "الدور",
    "Email": "البريد الإلكتروني",
    "Name": "الاسم",
    "Today": "اليوم",
    "Live": "مباشر",
    "Pending": "معلق",
    "Confirmed": "مؤكد",
    "Delivered": "تم التسليم",
    "Cancelled": "ملغي",
    "Failed": "فشل",
    "Paid": "مدفوع",
    "COD": "دفع عند الاستلام",
    "Open": "مفتوح",
    "Closed": "مغلق",
    "High": "مرتفع",
    "Medium": "متوسط",
    "Low": "منخفض",
    "Platform": "المنصة",
    "Workflow": "سير العمل",
    "Integrations": "التكاملات",
    "Login": "تسجيل الدخول",
    "Register": "إنشاء حساب",
    "Request Demo": "اطلب عرضًا",
    "Built for fast-moving ecommerce teams": "مصمم لفرق التجارة الإلكترونية سريعة الحركة",
    "Run orders, confirmations, shipping, and support from one control room.": "أدر الطلبات والتأكيدات والشحن والدعم من غرفة تحكم واحدة.",
    "Run orders, confirmations, shipping, and support from one": "أدر الطلبات والتأكيدات والشحن والدعم من",
    "control room.": "غرفة تحكم واحدة.",
    "Store OMS gives operations teams a shared workspace for high-volume order management, live fulfillment visibility, and the signals needed to remove delays before customers feel them.": "يوفر Store OMS لفرق العمليات مساحة عمل مشتركة لإدارة الطلبات بكثافة، ورؤية مباشرة للتنفيذ، وإشارات تساعد على إزالة التأخير قبل أن يشعر به العملاء.",
    "Store OMS gives operations teams a shared workspace for": "يوفر Store OMS لفرق العمليات مساحة عمل مشتركة لـ",
    "high-volume order management, live fulfillment visibility, and": "إدارة الطلبات بكثافة، ورؤية مباشرة للتنفيذ، و",
    "the signals needed to remove delays before customers feel them.": "الإشارات اللازمة لإزالة التأخير قبل أن يشعر به العملاء.",
    "Start managing orders": "ابدأ إدارة الطلبات",
    "Explore platform": "استكشف المنصة",
    "Orders synced": "طلبات تمت مزامنتها",
    "Across stores and channels": "عبر المتاجر والقنوات",
    "Fulfillment SLA": "اتفاقية مستوى التنفيذ",
    "Tracked from order to delivery": "متابعة من الطلب حتى التسليم",
    "Team response": "استجابة الفريق",
    "Average handling time": "متوسط وقت المعالجة",
    "Operations pulse": "نبض العمليات",
    "Today's command view": "لوحة التحكم اليومية",
    "New orders": "طلبات جديدة",
    "Ready to ship": "جاهزة للشحن",
    "Open tickets": "تذاكر مفتوحة",
    "Fulfillment throughput": "معدل تنفيذ الطلبات",
    "Confirmed orders moving to warehouse": "طلبات مؤكدة تنتقل إلى المخزن",
    "At risk": "معرضة للخطر",
    "8 orders": "8 طلبات",
    "Missing address or customer confirmation.": "العنوان أو تأكيد العميل غير مكتمل.",
    "Next action": "الإجراء التالي",
    "Notify confirmation team": "إخطار فريق التأكيد",
    "WhatsApp follow-up ready for queued orders.": "متابعة واتساب جاهزة للطلبات المنتظرة.",
    "Connect the systems your operations already use": "اربط الأنظمة التي تستخدمها عملياتك بالفعل",
    "One workspace for the full order lifecycle.": "مساحة عمل واحدة لدورة حياة الطلب بالكامل.",
    "Replace scattered spreadsheets and chat handoffs with a system that reflects how ecommerce operations actually move.": "استبدل الجداول المتناثرة وتسليمات الدردشة بنظام يعكس طريقة حركة عمليات التجارة الإلكترونية فعليًا.",
    "Order Command Center": "مركز قيادة الطلبات",
    "Unify WooCommerce orders, customer notes, confirmation status, invoices, and warehouse handoff in one operating view.": "اجمع طلبات WooCommerce وملاحظات العملاء وحالة التأكيد والفواتير وتسليم المخزن في عرض تشغيلي واحد.",
    "Shipment Visibility": "رؤية الشحنات",
    "Track active deliveries, shipping exceptions, and hub movement before they become support escalations.": "تابع عمليات التسليم النشطة واستثناءات الشحن وحركة الفروع قبل أن تتحول إلى تصعيد دعم.",
    "Role-based Operations": "عمليات حسب الأدوار",
    "Give confirmation, warehouse, invoicing, support, and admins the exact workspace they need.": "امنح فرق التأكيد والمخزن والفواتير والدعم والمديرين مساحة العمل المناسبة لكل دور.",
    "Ready for daily operations": "جاهز للعمليات اليومية",
    "A cleaner flow from checkout to delivery.": "سير أوضح من الدفع إلى التسليم.",
    "Store OMS keeps every team aligned around the same operational truth: what needs confirmation, what is ready to pick, what is delayed, and what needs customer support.": "يحافظ Store OMS على توافق كل فريق حول نفس الحقيقة التشغيلية: ما يحتاج إلى تأكيد، وما هو جاهز للتجهيز، وما هو متأخر، وما يحتاج إلى دعم العملاء.",
    "See the dashboard": "اعرض لوحة التحكم",
    "Capture": "الالتقاط",
    "Orders arrive from your storefront with customer, product, and payment context ready for action.": "تصل الطلبات من متجرك ومعها بيانات العميل والمنتج والدفع جاهزة للتنفيذ.",
    "Confirm": "التأكيد",
    "Teams validate customer intent, share WhatsApp follow-ups, and resolve missing details quickly.": "تتحقق الفرق من نية العميل وترسل متابعات واتساب وتحل التفاصيل الناقصة بسرعة.",
    "Fulfill": "التنفيذ",
    "Warehouse and shipment teams move confirmed orders through packing, invoicing, and carrier pickup.": "تنقل فرق المخزن والشحن الطلبات المؤكدة عبر التجهيز والفوترة واستلام شركة الشحن.",
    "Optimize": "التحسين",
    "Analytics surface bottlenecks, delivery risk, revenue trends, and team performance in real time.": "تكشف التحليلات الاختناقات ومخاطر التسليم واتجاهات الإيرادات وأداء الفريق لحظيًا.",
    "Revenue and fulfillment performance": "أداء الإيرادات والتنفيذ",
    "Spot bottlenecks before they cost revenue.": "اكتشف الاختناقات قبل أن تكلفك الإيرادات.",
    "Chart range": "نطاق الرسم البياني",
    "Confirmed orders": "طلبات مؤكدة",
    "Delivery health": "صحة التسليم",
    "Open analytics": "فتح التحليلات",
    "Shipment accuracy": "دقة الشحن",
    "Monitor dispatch, in-transit volume, failed attempts, and delivery exceptions.": "راقب الإرسال وحجم الشحنات قيد النقل والمحاولات الفاشلة واستثناءات التسليم.",
    "Team productivity": "إنتاجية الفريق",
    "See confirmation speed, ticket load, warehouse queue depth, and invoicing progress.": "اعرف سرعة التأكيد وضغط التذاكر وعمق قائمة المخزن وتقدم الفوترة.",
    "Automation signals": "إشارات الأتمتة",
    "Use operational thresholds to route work and reduce repeated manual checks.": "استخدم حدودًا تشغيلية لتوجيه العمل وتقليل الفحوصات اليدوية المتكررة.",
    "Keep storefront, carrier, and customer updates in sync.": "حافظ على تزامن تحديثات المتجر وشركة الشحن والعميل.",
    "The landing page now reflects the systems already present in the product: storefront webhooks, shipping providers, WhatsApp confirmation, and secure team access.": "تعكس صفحة الهبوط الآن الأنظمة الموجودة بالفعل في المنتج: ويب هوكس المتجر، ومزودي الشحن، وتأكيد واتساب، ووصول الفريق الآمن.",
    "Order webhooks and catalog context": "ويب هوكس الطلبات وسياق الكتالوج",
    "Shipment creation and tracking": "إنشاء الشحنات وتتبعها",
    "Confirmation and customer updates": "التأكيد وتحديثات العملاء",
    "Auth, app data, and operational state": "المصادقة وبيانات التطبيق والحالة التشغيلية",
    "Ready to turn order chaos into a clear operating rhythm?": "هل أنت جاهز لتحويل فوضى الطلبات إلى إيقاع تشغيلي واضح؟",
    "Give every team a reliable source of truth for orders, confirmations, shipping, support, and analytics.": "امنح كل فريق مصدر حقيقة موثوقًا للطلبات والتأكيدات والشحن والدعم والتحليلات.",
    "Schedule Demo": "احجز عرضًا",
    "Create Account": "إنشاء حساب",
    "Built for high-volume ecommerce operations.": "مصمم لعمليات التجارة الإلكترونية عالية الحجم.",
    "Privacy Policy": "سياسة الخصوصية",
    "Terms of Service": "شروط الخدمة",
    "Security": "الأمان",
    "API Documentation": "توثيق API",
    "Contact Sales": "تواصل مع المبيعات",
    "Order Management": "إدارة الطلبات",
    "Review and fulfill your daily incoming orders.": "راجع ونفذ طلبات اليوم الواردة.",
    "Order, customer, or phone…": "طلب أو عميل أو هاتف…",
    "All Payments": "كل طرق الدفع",
    "Order ID": "رقم الطلب",
    "Phone": "الهاتف",
    "Payment": "الدفع",
    "Fulfillment": "التنفيذ",
    "Bosta": "بوستا",
    "Row actions": "إجراءات الصف",
    "Order board": "لوحة الطلبات",
    "Fulfillment stages as columns on wide screens; stacked flow on mobile.": "مراحل التنفيذ كأعمدة على الشاشات الواسعة، وكتدفق رأسي على الهاتف.",
    "Open in WooCommerce": "فتح في WooCommerce",
    "View order": "عرض الطلب",
    "Order total": "إجمالي الطلب",
    "Items": "العناصر",
    "SKU": "SKU",
    "Admin": "الإدارة",
    "Stage pipeline, team throughput, and bottlenecks. Requires an admin or moderator role.": "مسار المراحل وإنتاجية الفريق والاختناقات. يتطلب دور مدير أو مشرف.",
    "Orders and value by stage": "الطلبات والقيمة حسب المرحلة",
    "No data": "لا توجد بيانات",
    "Team performance": "أداء الفريق",
    "Order": "الطلب",
    "Stage": "المرحلة",
    "Waiting": "قيد الانتظار",
    "Required next action": "الإجراء التالي المطلوب",
    "Target": "الهدف",
    "Done": "منجز",
    "Performance": "الأداء",
    "Analytics Dashboard": "لوحة التحليلات",
    "Panoramic view of commercial performance and fulfillment health.": "نظرة شاملة على الأداء التجاري وصحة التنفيذ.",
    "Create or view orders": "إنشاء أو عرض الطلبات",
    "Revenue performance": "أداء الإيرادات",
    "Orders vs returns": "الطلبات مقابل المرتجعات",
    "Shipping trend": "اتجاه الشحن",
    "Stage distribution (orders & value)": "توزيع المراحل (الطلبات والقيمة)",
    "Possible bottleneck": "اختناق محتمل",
    "Track carrier movement, milestones, and exceptions.": "تابع حركة شركات الشحن والمحطات والاستثناءات.",
    "From": "من",
    "To": "إلى",
    "Active shipments": "الشحنات النشطة",
    "AWB / ID": "رقم الشحنة / المعرف",
    "Carrier": "شركة الشحن",
    "Shipment detail": "تفاصيل الشحنة",
    "AWB": "رقم الشحنة",
    "Carrier fees": "رسوم شركة الشحن",
    "Bosta status": "حالة بوستا",
    "Last sync": "آخر مزامنة",
    "Created by": "أنشأ بواسطة",
    "Created at": "تاريخ الإنشاء",
    "Route map": "خريطة المسار",
    "Warehouse queue": "قائمة انتظار المخزن",
    "Revert": "إرجاع",
    "Track scan (AWB)": "تتبع المسح (AWB)",
    "Tracking number (AWB)": "رقم التتبع (AWB)",
    "Revert stage": "إرجاع المرحلة",
    "Short reason for supervisor / audit log": "سبب مختصر للمشرف / سجل التدقيق",
    "Ticket Management": "إدارة التذاكر",
    "Triage support work across new, in-progress, and pending response queues.": "رتب أعمال الدعم بين قوائم الجديد وقيد التنفيذ والمنتظر للرد.",
    "Search by WooCommerce order ID, customer, or phone": "ابحث برقم طلب WooCommerce أو العميل أو الهاتف",
    "Search by customer, phone, or order number…": "ابحث بالعميل أو الهاتف أو رقم الطلب…",
    "Sort (coming soon)": "الترتيب (قريبًا)",
    "Complaint": "شكوى",
    "Return": "مرتجع",
    "Exchange": "استبدال",
    "Assigned to": "مسند إلى",
    "Shipments from ticket": "الشحنات من التذكرة",
    "Resolution": "الحل",
    "Type": "النوع",
    "Manage team members, roles, and daily goals.": "أدر أعضاء الفريق والأدوار والأهداف اليومية.",
    "Manage your workspace configuration and personal preferences.": "أدر إعدادات مساحة العمل وتفضيلاتك الشخصية.",
    "Session API secret": "سر API للجلسة",
    "Session Bearer key (e.g. tenant staff API key)": "مفتاح Bearer للجلسة (مثل مفتاح API لموظفي التاجر)",
    "WooCommerce (WordPress)": "WooCommerce (WordPress)",
    "Paste WooCommerce webhook secret": "الصق سر webhook الخاص بـ WooCommerce",
    "Storefront order forwarding": "تمرير طلبات المتجر",
    "Webhook health (server)": "صحة Webhook (الخادم)",
    "Time (UTC)": "الوقت (UTC)",
    "OMS order": "طلب OMS",
    "Tenant staff API key": "مفتاح API لموظفي التاجر",
    "Bosta API key": "مفتاح API لبوستا",
    "Secret header name": "اسم ترويسة السر",
    "Shared secret": "السر المشترك",
    "Secret sent by the store frontend": "السر المرسل من واجهة المتجر",
    "Notification preferences": "تفضيلات الإشعارات",
    "Dark": "داكن",
    "Light": "فاتح",
    "System": "النظام",
    "Kanban column config": "إعداد أعمدة Kanban",
    "After confirmed": "بعد التأكيد",
    "After invoiced (warehouse ready)": "بعد الفوترة (جاهز للمخزن)",
    "Warehouse scan (AWB)": "مسح المخزن (AWB)",
    "Order status webhooks": "Webhooks حالة الطلب",
    "Recent webhook deliveries": "آخر تسليمات Webhook",
    "Payment providers": "مزودو الدفع",
    "Developer session headers": "ترويسات جلسة المطور",
    "Webhook URL": "رابط Webhook",
    "Permissions": "الصلاحيات",
    "Pages": "الصفحات",
    "Users / Finance": "المستخدمون / المالية",
    "Uncheck role defaults to hide pages/actions. Financial data is off unless Finance: view is checked.": "ألغ تحديد الصلاحيات الافتراضية للدور لإخفاء الصفحات أو الإجراءات. البيانات المالية مغلقة ما لم يتم تحديد Finance: view.",
    "role": "الدور",
    "Orders view": "طريقة عرض الطلبات",
    "List": "قائمة",
    "Board": "لوحة",
    "Theme: dark (click to cycle)": "المظهر: داكن (اضغط للتبديل)",
    "Theme: light (click to cycle)": "المظهر: فاتح (اضغط للتبديل)",
    "Theme: system (click to cycle)": "المظهر: النظام (اضغط للتبديل)",
    "pending_confirmation": "بانتظار التأكيد",
    "confirmed": "مؤكد",
    "invoiced": "تمت الفوترة",
    "warehouse_ready": "جاهز للمخزن",
    "packed": "تم التجهيز",
    "shipped": "تم الشحن",
    "delivered": "تم التسليم",
    "follow_up": "متابعة",
    "cancelled": "ملغي",
    "paid": "مدفوع",
    "partial": "مدفوع جزئيًا",
    "cod": "دفع عند الاستلام",
    "complaint": "شكوى",
    "return": "مرتجع",
    "exchange": "استبدال",
    "resolved": "تم الحل",
    "closed": "مغلق",
    "open": "مفتوح",
    "pending": "معلق",
    "Enter your email.": "أدخل بريدك الإلكتروني.",
    "Precision logistics, one login away.": "لوجستيات دقيقة، على بعد تسجيل دخول واحد.",
    "Unified orders, shipments, and support workflows — built for teams that cannot afford downtime.": "طلبات وشحنات ودعم في منظومة واحدة — لفرق لا تتحمل توقف الخدمة.",
    "Sign in": "تسجيل الدخول",
    "Use the email and password for your Firebase account.": "استخدم البريد وكلمة المرور لحساب Firebase الخاص بك.",
    "Use your per-tenant staff API key (Bearer) as the password, or a demo token for mock tenants. Set tenant and user id if you are not on the default demo.":
      "استخدم مفتاح API للموظفين (Bearer) ككلمة مرور، أو رمزًا تجريبيًا للمستأجرين التجريبيين. عيّن المستأجر ومعرف المستخدم إذا لم تكن على الوضع التجريبي الافتراضي.",
    "Password": "كلمة المرور",
    "Tenant ID": "معرف المستأجر",
    "User ID (optional)": "معرف المستخدم (اختياري)",
    "From registration or demo user id": "من التسجيل أو معرف مستخدم تجريبي",
    "Signing in…": "جارٍ تسجيل الدخول…",
    "Continue": "متابعة",
    "New company?": "شركة جديدة؟",
    "Create an account": "إنشاء حساب",
    "Back to home": "العودة للرئيسية",
    "Sign-in failed": "فشل تسجيل الدخول",
    "Fill in company, your name, and email.": "أكمل اسم الشركة واسمك والبريد الإلكتروني.",
    "Register your company": "سجّل شركتك",
    "Create a tenant, get your WooCommerce webhook URL, and invite your team. Bosta and other carriers are configured per company in Settings.":
      "أنشئ مستأجرًا واحصل على رابط webhook لـ WooCommerce وادعُ فريقك. يتم ضبط بوستا والناقلين الآخرين لكل شركة من الإعدادات.",
    "Create account": "إنشاء حساب",
    "Mock mode: no Firebase needed. After signup you are signed in automatically; save the staff API key for API scripts.":
      "وضع تجريبي: لا حاجة لـ Firebase. بعد التسجيل تُسجَّل دخولك تلقائيًا؛ احفظ مفتاح API للموظفين لاستخدامه في السكربتات.",
    "Creates a Firebase Auth user and your company tenant.": "ينشئ مستخدم Firebase Auth ومستأجر شركتك.",
    "Registration needs either": "التسجيل يتطلب إما",
    "for local mock onboarding, or": "للتسجيل التجريبي المحلي، أو",
    "for production-style signup.": "للتسجيل كما في الإنتاج.",
    "Company name": "اسم الشركة",
    "Your name": "اسمك",
    "Full name": "الاسم الكامل",
    "At least 6 characters": "6 أحرف على الأقل",
    "Creating…": "جارٍ الإنشاء…",
    "Create company": "إنشاء الشركة",
    "Already have access?": "لديك حساب بالفعل؟",
    "Registration failed": "فشل التسجيل",
    "Firebase is not configured for this deployment.": "لم يُضبط Firebase لهذا النشر.",
    "Password must be at least 6 characters.": "يجب أن تكون كلمة المرور 6 أحرف على الأقل.",
    "Internal": "داخلي",
    "Super Admin": "مشرف عام",
    "Companies": "الشركات",
    "Packages": "الباقات",
    "Suspended": "موقوف",
    "Active": "نشط",
    "No webhook logs": "لا سجلات webhook",
    "Webhook OK": "Webhook سليم",
    "Webhook failing": "Webhook يفشل",
    "Platform access": "وصول المنصة",
    "Use dev-super-admin in mock mode": "استخدم dev-super-admin في الوضع التجريبي",
    "Load companies": "تحميل الشركات",
    "Could not load companies": "تعذر تحميل الشركات",
    "Package": "الباقة",
    "All packages": "كل الباقات",
    "Integration": "التكامل",
    "All integrations": "كل التكاملات",
    "WooCommerce connected": "WooCommerce متصل",
    "Woo webhook failing": "فشل webhook ووكومرس",
    "Bosta connected": "بوستا متصل",
    "All statuses": "كل الحالات",
    "Company": "الشركة",
    "Counts": "الأعداد",
    "No companies match the current filters.": "لا توجد شركات تطابق الفلاتر الحالية.",
    "Details": "التفاصيل",
    "No package": "لا باقة",
    "Woo": "وو",
    "orders /": "طلبات /",
    "users /": "مستخدمون /",
    "tickets": "تذاكر",
    "shipments": "شحنات",
    "orders": "طلبات",
    "Create package": "إنشاء باقة",
    "Max users": "الحد الأقصى للمستخدمين",
    "Orders/month": "طلبات/شهر",
    "Standard": "قياسي",
    "Priority": "أولوية",
    "Dedicated": "مخصص",
    "Limits": "الحدود",
    "Features": "الميزات",
    "Action": "إجراء",
    "No packages yet.": "لا توجد باقات بعد.",
    "Archived": "مؤرشف",
    "Unlimited": "غير محدود",
    "Archive": "أرشفة",
    "Activate": "تفعيل",
    "Could not load packages": "تعذر تحميل الباقات",
    "Could not create package": "تعذر إنشاء الباقة",
    "Could not update package": "تعذر تحديث الباقة",
    "Could not load company": "تعذر تحميل الشركة",
    "Could not update company": "تعذر تحديث الشركة",
    "Back to companies": "العودة إلى الشركات",
    "Loading company...": "جارٍ تحميل الشركة…",
    "Slug": "المعرّف النصي",
    "API key": "مفتاح API",
    "Configured": "مُضبط",
    "Missing": "غير موجود",
    "Connected": "متصل",
    "Not connected": "غير متصل",
    "Storefront orders": "طلبات الواجهة",
    "Outbound webhooks": "Webhooks صادرة",
    "Manage activity and package": "إدارة النشاط والباقة",
    "Assigned package": "الباقة المعيّنة",
    "Save package": "حفظ الباقة",
    "Reactivate": "إعادة التفعيل",
    "Suspend": "إيقاف",
    "standard": "قياسي",
    "priority": "أولوية",
    "dedicated": "مخصص",
    "woocommerce": "WooCommerce",
    "storefrontOrders": "طلبات الواجهة",
    "outboundWebhooks": "Webhooks صادرة",
    "bosta": "بوستا",
  },
};

export function translateLiteral(locale: Locale, value: string): string {
  return commonText[locale][value] ?? value;
}

export function interpolate(value: string, vars: Record<string, string | number>) {
  return Object.entries(vars).reduce(
    (next, [key, replacement]) => next.replaceAll(`{${key}}`, String(replacement)),
    value,
  );
}
