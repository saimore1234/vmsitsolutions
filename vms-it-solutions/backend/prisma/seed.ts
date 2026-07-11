import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const RESOURCES = [
  "dashboard", "users", "roles", "settings", "leads", "blogs", "pages", "media",
  "services", "products", "industries", "team", "clients", "testimonials",
  "faq", "careers", "logs", "popups",
];
const ACTIONS = ["view", "create", "edit", "delete", "approve", "export", "import", "print", "manage"];

const SYSTEM_ROLES: { name: string; slug: string; grants: (r: string, a: string) => boolean }[] = [
  { name: "Super Admin", slug: "super-admin", grants: () => true },
  { name: "Admin", slug: "admin", grants: (r) => r !== "roles" },
  { name: "Manager", slug: "manager", grants: (r, a) => !["users", "roles", "settings", "logs"].includes(r) && a !== "delete" },
  { name: "Sales", slug: "sales", grants: (r, a) => (r === "leads" && a !== "manage") || (r === "dashboard" && a === "view") },
  { name: "Marketing", slug: "marketing", grants: (r, a) => ["blogs", "pages", "media", "testimonials", "faq", "popups"].includes(r) && a !== "manage" },
  { name: "HR", slug: "hr", grants: (r, a) => (["careers", "team"].includes(r) && a !== "manage") || (r === "dashboard" && a === "view") },
  { name: "Support", slug: "support", grants: (r, a) => r === "leads" && ["view", "edit"].includes(a) },
  { name: "Developer", slug: "developer", grants: (r, a) => ["pages", "media", "logs"].includes(r) && ["view", "create", "edit"].includes(a) },
  { name: "Employee", slug: "employee", grants: (r, a) => r === "dashboard" && a === "view" },
  { name: "Customer", slug: "customer", grants: () => false },
  { name: "Guest", slug: "guest", grants: () => false },
];

async function main() {
  console.log("Seeding permissions…");
  for (const resource of RESOURCES) {
    for (const action of ACTIONS) {
      await prisma.permission.upsert({
        where: { resource_action: { resource, action } },
        update: {},
        create: { resource, action },
      });
    }
  }
  const allPerms = await prisma.permission.findMany();

  console.log("Seeding roles…");
  for (const def of SYSTEM_ROLES) {
    const role = await prisma.role.upsert({
      where: { slug: def.slug },
      update: {},
      create: { name: def.name, slug: def.slug, isSystem: true },
    });
    const grant = allPerms.filter((p: { resource: string; action: string; id: string }) => def.grants(p.resource, p.action));
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: grant.map((p: { id: string }) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });
  }

  console.log("Seeding super admin user…");
  const superRole = await prisma.role.findUniqueOrThrow({ where: { slug: "super-admin" } });
  await prisma.user.upsert({
    where: { email: "admin@vmsitsolutions.com" },
    update: {},
    create: {
      email: "admin@vmsitsolutions.com",
      password: await bcrypt.hash("Admin@12345", 12),
      firstName: "Super",
      lastName: "Admin",
      emailVerified: true,
      roleId: superRole.id,
      designation: "Administrator",
    },
  });

  console.log("Seeding settings…");
  await prisma.companySetting.upsert({
    where: { id: "company" },
    update: {},
    create: {
      id: "company",
      companyName: "VMS IT Solutions",
      shortName: "VMS",
      tagline: "ERP consulting that ships",
      city: "Mumbai", state: "Maharashtra", country: "India",
      email: "hello@vmsitsolutions.com",
      supportEmail: "support@vmsitsolutions.com",
      salesEmail: "sales@vmsitsolutions.com",
      phone: "+91 22 4000 0000",
      whatsapp: "+91 98200 00000",
      workingHours: "Mon–Sat, 9:30 AM – 6:30 PM IST",
      mission: "Give every mid-market manufacturer and distributor enterprise-grade operations software without enterprise-grade friction.",
      vision: "To be the most trusted ERP implementation partner in India.",
      description: "VMS IT Solutions implements, customises and supports ERPNext and SAP Business One for manufacturing, distribution and services companies.",
    },
  });
  await prisma.websiteSetting.upsert({ where: { id: "website" }, update: {}, create: { id: "website" } });
  await prisma.themeSetting.upsert({ where: { id: "theme" }, update: {}, create: { id: "theme" } });
  await prisma.smtpSetting.upsert({ where: { id: "smtp" }, update: {}, create: { id: "smtp" } });
  await prisma.logoSetting.upsert({ where: { id: "logo" }, update: {}, create: { id: "logo" } });
  await prisma.communicationSetting.upsert({
    where: { id: "communication" },
    update: {},
    create: {
      id: "communication",
      whatsappNumber: "919137801103",
      whatsappDefaultMessage:
        "Hello VMS IT Solutions,\n\nA new website enquiry has been submitted.\n\nName:\n{{name}}\n\nEmail:\n{{email}}\n\nPhone:\n{{phone}}\n\nCompany:\n{{company}}\n\nInterested In:\n{{service}}\n\nMessage:\n{{message}}\n\nSubmitted from:\nWebsite Contact Form",
    },
  });

  for (const [platform, url] of [
    ["linkedin", "https://linkedin.com/company/vms-it-solutions"],
    ["twitter", "https://x.com/vmsitsolutions"],
    ["youtube", "https://youtube.com/@vmsitsolutions"],
  ] as const) {
    await prisma.socialLink.upsert({ where: { platform }, update: {}, create: { platform, url } });
  }

  console.log("Seeding navigation…");
  const header = await prisma.menu.upsert({ where: { name: "header" }, update: {}, create: { name: "header" } });
  const footer = await prisma.menu.upsert({ where: { name: "footer" }, update: {}, create: { name: "footer" } });
  await prisma.menuItem.deleteMany({ where: { menuId: { in: [header.id, footer.id] } } });
  await prisma.menuItem.createMany({
    data: [
      { menuId: header.id, label: "Products", url: "/products", sortOrder: 1 },
      { menuId: header.id, label: "Services", url: "/services", sortOrder: 2 },
      { menuId: header.id, label: "Industries", url: "/industries", sortOrder: 3 },
      { menuId: header.id, label: "Blog", url: "/blog", sortOrder: 4 },
      { menuId: header.id, label: "Careers", url: "/careers", sortOrder: 5 },
      { menuId: header.id, label: "Contact", url: "/contact", sortOrder: 6 },
      { menuId: footer.id, label: "About", url: "/about", sortOrder: 1 },
      { menuId: footer.id, label: "Privacy Policy", url: "/privacy", sortOrder: 2 },
      { menuId: footer.id, label: "Terms of Service", url: "/terms", sortOrder: 3 },
    ],
  });

  console.log("Seeding products…");
  const products = [
    ["ERPNext", "Full-stack open-source ERP — implemented, customised and hosted by our certified team."],
    ["SAP Business One", "SAP's mid-market ERP with our industry-specific add-ons and local compliance packs."],
    ["CRM", "Pipeline, quotations and after-sales in one place, connected to your ERP."],
    ["HRMS", "Attendance, leave, appraisals and Indian payroll statutory compliance."],
    ["Inventory", "Multi-warehouse stock with batch, serial and barcode workflows."],
    ["Manufacturing", "BOMs, work orders, subcontracting and shop-floor terminals."],
    ["Accounting", "GST-ready books, multi-currency and consolidated group reporting."],
    ["Payroll", "Automated salary runs with PF, ESI, PT and TDS built in."],
    ["Projects", "Project costing, timesheets and milestone billing."],
    ["Asset Management", "Asset lifecycle from purchase to depreciation to disposal."],
    ["Quality", "Inspection plans, NCRs and CAPA tracking tied to production."],
    ["Purchase", "Requisition-to-payment with supplier scorecards."],
    ["Sales", "Quotation-to-cash with credit control and dispatch planning."],
  ];
  for (let i = 0; i < products.length; i++) {
    const [name, shortDesc] = products[i];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await prisma.product.upsert({ where: { slug }, update: {}, create: { name, slug, shortDesc, sortOrder: i } });
  }

  console.log("Seeding services…");
  const services = [
    ["ERP Implementation", "Discovery, configuration, data migration, training and go-live in 8–16 weeks."],
    ["ERP Customisation", "Custom doctypes, workflows, print formats and integrations built to your process."],
    ["Data Migration", "Clean, validated migration from Tally, Excel or legacy ERPs with reconciliation reports."],
    ["Integration Services", "Connect your ERP to e-commerce, banks, GST portal, WhatsApp and shop-floor machines."],
    ["Managed Support (AMC)", "SLA-backed support desk, health monitoring, patching and quarterly reviews."],
    ["Cloud Hosting", "Hardened, backed-up hosting with 99.9% uptime for your ERP workloads."],
  ];
  for (let i = 0; i < services.length; i++) {
    const [name, shortDesc] = services[i];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await prisma.service.upsert({ where: { slug }, update: {}, create: { name, slug, shortDesc, sortOrder: i } });
  }

  console.log("Seeding industries, testimonials, FAQ…");
  const industries = ["Manufacturing", "Distribution & Trading", "Retail", "Pharmaceuticals", "Engineering", "Logistics"];
  for (let i = 0; i < industries.length; i++) {
    const name = industries[i];
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    await prisma.industry.upsert({ where: { slug }, update: {}, create: { name, slug, sortOrder: i } });
  }

  if ((await prisma.testimonial.count()) === 0) {
    await prisma.testimonial.createMany({
      data: [
        { name: "Rahul Mehta", company: "Precision Gears Pvt Ltd", role: "Managing Director", content: "VMS moved us from three disconnected systems to one ERPNext instance in eleven weeks. Month-end closing went from nine days to two.", sortOrder: 0 },
        { name: "Sneha Kulkarni", company: "Medilife Distributors", role: "Operations Head", content: "Batch tracking and expiry management finally work the way our pharma distribution business needs. Support responses come within the hour.", sortOrder: 1 },
        { name: "Arif Shaikh", company: "Coastal Polymers", role: "CFO", content: "The GST compliance pack alone paid for the project. Our auditors now get everything from one login.", sortOrder: 2 },
      ],
    });
  }

  if ((await prisma.faq.count()) === 0) {
    await prisma.faq.createMany({
      data: [
        { question: "How long does an ERP implementation take?", answer: "Most mid-market implementations go live in 8–16 weeks depending on modules, data quality and customisation scope. We fix the timeline in the statement of work before we start.", sortOrder: 0 },
        { question: "ERPNext or SAP Business One — which should we choose?", answer: "ERPNext suits companies that want flexibility and lower licence cost; SAP B1 suits companies that need SAP's ecosystem or are mandated by group companies. We run a fit-gap workshop and recommend based on your processes, not our margins.", sortOrder: 1 },
        { question: "Do you migrate data from Tally?", answer: "Yes — masters, opening balances and optionally historical transactions, with a reconciliation report your auditor can sign off.", sortOrder: 2 },
        { question: "What does support cost after go-live?", answer: "Annual maintenance contracts start at a fixed monthly fee covering a support desk, monitoring and minor changes, with defined SLAs.", sortOrder: 3 },
      ],
    });
  }

  console.log("Seed complete.");
  console.log("Login: admin@vmsitsolutions.com / Admin@12345");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
