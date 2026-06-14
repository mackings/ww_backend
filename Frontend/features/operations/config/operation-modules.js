const field = (name, label, options = {}) => ({ name, label, type: "text", ...options });

const currency = (value) => new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0
}).format(Number(value) || 0);

const date = (value) => value ? new Date(value).toLocaleDateString() : "-";
const text = (value) => value ?? "-";
const numeric = (value) => Number(String(value ?? "").replace(/,/g, "")) || 0;

const resource = (id, label, path, options = {}) => ({
  id,
  label,
  path,
  method: "GET",
  rows: (payload) => payload?.data || [],
  ...options
});

export const operationModules = {
  auth: {
    title: "Account & Company",
    description: "Manage your companies, active workspace and staff access.",
    resources: [
      resource("companies", "Companies", "/api/auth/companies", {
        columns: [
          ["name", "Company"],
          ["email", "Email"],
          ["role", "Role"],
          ["accessGranted", "Access", (value) => value === false ? "Revoked" : "Active"]
        ],
        create: {
          label: "New company",
          path: "/api/auth/company",
          fields: [
            field("companyName", "Company name", { required: true }),
            field("companyEmail", "Company email", { type: "email" }),
            field("companyPhone", "Phone number"),
            field("companyAddress", "Address")
          ]
        },
        rowActions: [
          { label: "Switch", path: "/api/auth/switch-company", method: "POST", body: (_, index) => ({ companyIndex: index }), refreshUser: true }
        ]
      }),
      resource("staff", "Staff", "/api/auth/staff", {
        columns: [
          ["fullname", "Name"],
          ["email", "Email"],
          ["position", "Position"],
          ["role", "Role"],
          ["accessGranted", "Access", (value) => value === false ? "Revoked" : "Active"]
        ],
        create: {
          label: "Invite staff",
          path: "/api/auth/invite-staff",
          fields: [
            field("fullname", "Full name", { required: true }),
            field("email", "Email", { type: "email", required: true }),
            field("phoneNumber", "Phone number", { required: true }),
            field("role", "Role", { type: "select", options: ["admin", "staff"], required: true }),
            field("position", "Position", { required: true })
          ]
        },
        rowActions: [
          { label: "Revoke", path: (row) => `/api/auth/staff/${row.id}/revoke`, method: "PATCH", show: (row) => row.role !== "owner" && row.accessGranted !== false },
          { label: "Restore", path: (row) => `/api/auth/staff/${row.id}/restore`, method: "PATCH", show: (row) => row.accessGranted === false }
        ]
      })
    ]
  },
  materials: {
    title: "Materials Inventory",
    description: "Approved material stock, prices, dimensions and catalog coverage.",
    resources: [
      resource("materials", "All materials", "/api/product/materials", {
        query: { search: "", category: "", priced: "" },
        stats: [
          ["Total materials", (rows) => rows.length],
          ["Priced", (rows) => rows.filter((row) => row.isPriced).length],
          ["Unpriced", (rows) => rows.filter((row) => !row.isPriced).length],
          ["Categories", (rows) => new Set(rows.map((row) => row.category)).size]
        ],
        columns: [
          ["image", "Image", (value) => value, "image"],
          ["name", "Material"],
          ["category", "Category"],
          ["subCategory", "Type"],
          ["size", "Size"],
          ["pricingUnit", "Unit"],
          ["unitPrice", "Price", currency],
          ["isPriced", "Pricing", (value) => value ? "Priced" : "Unpriced"],
          ["status", "Status", text, "status"],
          ["companyName", "Source"]
        ],
        create: {
          label: "Add material",
          path: "/api/product/creatematerial",
          multipart: true,
          form: "material"
        }
      }),
      resource("catalog", "Supported catalog", "/api/product/materials/supported", {
        query: { page: 1, limit: 500, search: "", category: "", priced: "" },
        rows: (payload) => payload?.data || [],
        columns: [
          ["material", "Material"],
          ["category", "Category"],
          ["subCategory", "Type"],
          ["size", "Size"],
          ["unit", "Unit"],
          ["priceNumeric", "Catalog price", currency],
          ["isPriced", "Pricing", (value) => value ? "Priced" : "Unpriced"]
        ]
      })
    ]
  },
  products: {
    title: "Products",
    description: "Company products and their platform approval lifecycle.",
    resources: [
      resource("products", "Product library", "/api/product", {
        view: "cards",
        cardType: "products",
        query: { page: 1, limit: 100, search: "", status: "", category: "" },
        stats: [
          ["Products", (rows) => rows.length],
          ["Approved", (rows) => rows.filter((row) => row.status === "approved").length],
          ["Pending", (rows) => rows.filter((row) => row.status === "pending").length],
          ["Rejected", (rows) => rows.filter((row) => row.status === "rejected").length]
        ],
        columns: [
          ["image", "Image", (value) => value, "image"],
          ["name", "Product"],
          ["productId", "Code"],
          ["category", "Category"],
          ["subCategory", "Sub-category"],
          ["status", "Status", text, "status"],
          ["companyName", "Company"]
        ],
        create: {
          label: "New product",
          path: "/api/product",
          multipart: true,
          fields: [
            field("name", "Product name", { required: true }),
            field("category", "Category", { required: true }),
            field("subCategory", "Sub-category"),
            field("description", "Description", { type: "textarea" }),
            field("image", "Product image", { type: "file" })
          ]
        },
        rowActions: [
          { label: "Resubmit", path: (row) => `/api/product/${row._id}/resubmit`, method: "PATCH", multipart: true, show: (row) => row.status === "rejected" },
          { label: "Delete", path: (row) => `/api/product/${row._id}`, method: "DELETE", danger: true }
        ]
      })
    ]
  },
  quotations: {
    title: "Quotations",
    description: "Client estimates that automatically produce Build of Materials records.",
    resources: [
      resource("quotations", "Quotations", "/api/quotation", {
        view: "cards",
        cardType: "quotations",
        query: { page: 1, limit: 100, search: "", status: "" },
        stats: [
          ["Quotations", (rows) => rows.length],
          ["Sent", (rows) => rows.filter((row) => row.status === "sent").length],
          ["Approved", (rows) => rows.filter((row) => row.status === "approved").length],
          ["Quoted value", (rows) => currency(rows.reduce((sum, row) => sum + (row.finalTotal || 0), 0))]
        ],
        columns: [
          ["quotationNumber", "Quotation"],
          ["clientName", "Client"],
          ["phoneNumber", "Phone"],
          ["items", "Items", (value) => value?.length || 0],
          ["boms", "BOMs", (value) => value?.length || 0],
          ["finalTotal", "Total", currency],
          ["status", "Status", text, "status"],
          ["createdAt", "Created", date]
        ],
        create: {
          label: "Create quotation",
          path: "/api/quotation",
          fields: [
            field("clientName", "Client name", { required: true }),
            field("phoneNumber", "Phone number"),
            field("email", "Email", { type: "email" }),
            field("clientAddress", "Address"),
            field("description", "Description", { type: "textarea" }),
            field("boms", "Select BOMs", {
              type: "multi-lookup",
              required: true,
              lookup: {
                path: "/api/bom",
                query: { page: 1, limit: 100 },
                rows: (payload) => payload?.data || [],
                value: (row) => row._id,
                label: (row) => `${row.bomNumber} · ${row.name} · ${currency(row.pricing?.sellingPrice || row.totalCost)}`
              }
            }),
            field("discount", "Discount %", { type: "number", defaultValue: 0 }),
            field("dueDate", "Due date", { type: "date" })
          ],
          transform: (values) => {
            const boms = values.boms.map((value) => JSON.parse(value));
            return {
              clientName: values.clientName,
              phoneNumber: values.phoneNumber,
              email: values.email,
              clientAddress: values.clientAddress,
              description: values.description,
              discount: Number(values.discount || 0),
              dueDate: values.dueDate || null,
              items: boms.map((bom) => ({
                woodType: bom.product?.name || bom.name,
                description: bom.name,
                quantity: 1,
                costPrice: Number(bom.pricing?.costPrice || bom.totalCost || 0),
                sellingPrice: Number(bom.pricing?.sellingPrice || bom.totalCost || 0),
                unit: "piece",
                image: bom.product?.image || null
              })),
              boms: boms.map((bom) => ({
                name: bom.name,
                description: bom.description,
                product: bom.product,
                materials: bom.materials,
                additionalCosts: bom.additionalCosts,
                pricing: bom.pricing,
                expectedDuration: bom.expectedDuration,
                dueDate: bom.dueDate
              }))
            };
          }
        },
        rowActions: [
          { label: "Approve", path: (row) => `/api/quotation/${row._id}`, method: "PUT", body: () => ({ status: "approved" }), show: (row) => !["approved", "completed"].includes(row.status) },
          { label: "Delete", path: (row) => `/api/quotation/${row._id}`, method: "DELETE", danger: true }
        ]
      })
    ]
  },
  boms: {
    title: "Build of Materials",
    description: "Material requirements, additional costs and production pricing.",
    resources: [
      resource("boms", "BOM register", "/api/bom", {
        view: "cards",
        cardType: "boms",
        query: { page: 1, limit: 100, search: "" },
        stats: [
          ["BOMs", (rows) => rows.length],
          ["Materials cost", (rows) => currency(rows.reduce((sum, row) => sum + (row.materialsCost || 0), 0))],
          ["Additional costs", (rows) => currency(rows.reduce((sum, row) => sum + (row.additionalCostsTotal || 0), 0))],
          ["Total cost", (rows) => currency(rows.reduce((sum, row) => sum + (row.totalCost || 0), 0))]
        ],
        columns: [
          ["bomNumber", "BOM"],
          ["name", "Name"],
          ["product.name", "Product"],
          ["materials", "Materials", (value) => value?.length || 0],
          ["materialsCost", "Materials cost", currency],
          ["additionalCostsTotal", "Extras", currency],
          ["totalCost", "Total", currency],
          ["dueDate", "Due", date]
        ],
        create: {
          label: "Create BOM",
          path: "/api/bom",
          fields: [
            field("name", "BOM name", { required: true }),
            field("description", "Description", { type: "textarea" }),
            field("material", "Material", {
              type: "lookup",
              required: true,
              lookup: {
                path: "/api/product/materials",
                rows: (payload) => payload?.data || [],
                value: (row) => row._id,
                label: (row) => `${row.name} · ${row.subCategory || row.category} · ${currency(row.unitPrice || row.pricePerSqm)}`,
                serialize: true
              }
            }),
            field("quantity", "Quantity", { type: "number", defaultValue: 1 }),
            field("manualPrice", "Manual price (when unpriced)", { type: "number" }),
            field("squareMeter", "Square meters", { type: "number", defaultValue: 0 }),
            field("markupPercentage", "Markup %", { type: "number", defaultValue: 0 }),
            field("dueDate", "Due date", { type: "date" })
          ],
          transform: (values) => {
            const material = JSON.parse(values.material);
            return {
              name: values.name,
              description: values.description,
              dueDate: values.dueDate || null,
              materials: [{
                materialId: material._id,
                name: material.name,
                category: material.category,
                subCategory: material.subCategory,
                quantity: Number(values.quantity || 1),
                price: Number(material.unitPrice || material.pricePerSqm || values.manualPrice || 0),
                squareMeter: Number(values.squareMeter || 0),
                unit: material.pricingUnit || material.unit || "piece"
              }],
              additionalCosts: [],
              pricing: { markupPercentage: Number(values.markupPercentage || 0) }
            };
          }
        },
        rowActions: [
          { label: "Delete", path: (row) => `/api/bom/${row._id}`, method: "DELETE", danger: true }
        ]
      })
    ]
  },
  orders: {
    title: "Orders & Production",
    description: "Convert approved quotations, track production and record payments.",
    resources: [
      resource("orders", "Orders", "/api/orders/get-orders", {
        view: "cards",
        cardType: "orders",
        query: { page: 1, limit: 100, search: "", status: "", paymentStatus: "" },
        rows: (payload) => payload?.data?.orders || [],
        stats: [
          ["Orders", (rows) => rows.length],
          ["In progress", (rows) => rows.filter((row) => row.status === "in_progress").length],
          ["Outstanding", (rows) => currency(rows.reduce((sum, row) => sum + (row.balance || 0), 0))],
          ["Order value", (rows) => currency(rows.reduce((sum, row) => sum + (row.totalAmount || 0), 0))]
        ],
        columns: [
          ["orderNumber", "Order"],
          ["clientName", "Client"],
          ["totalAmount", "Total", currency],
          ["amountPaid", "Paid", currency],
          ["balance", "Balance", currency],
          ["paymentStatus", "Payment", text, "status"],
          ["status", "Production", text, "status"],
          ["assignedTo.fullname", "Assigned to"]
        ],
        create: {
          label: "Create from quotation",
          path: "/api/orders/create",
          fields: [
            field("quotationId", "Quotation", {
              type: "lookup",
              required: true,
              lookup: {
                path: "/api/quotation",
                query: { page: 1, limit: 100 },
                rows: (payload) => payload?.data || [],
                filter: (row) => ["approved", "sent"].includes(row.status),
                value: (row) => row._id,
                label: (row) => `${row.quotationNumber} · ${row.clientName} · ${currency(row.finalTotal)}`
              }
            }),
            field("startDate", "Start date", { type: "date" }),
            field("endDate", "End date", { type: "date" }),
            field("amountPaid", "Initial payment", { type: "number", defaultValue: 0, currency: true }),
            field("notes", "Notes", { type: "textarea" })
          ],
          validate: (values) => (
            values.startDate && values.endDate && new Date(values.endDate) < new Date(values.startDate)
              ? "Order end date cannot be earlier than the start date."
              : null
          )
        },
        rowActions: [
          { label: "Start", path: (row) => `/api/orders/update-orders/${row._id}/status`, method: "PATCH", body: () => ({ status: "in_progress" }), show: (row) => row.status === "pending" },
          { label: "Complete", path: (row) => `/api/orders/update-orders/${row._id}/status`, method: "PATCH", body: () => ({ status: "completed" }), show: (row) => row.status === "in_progress" },
          {
            label: "Record payment",
            path: (row) => `/api/orders/orders/${row._id}/payment`,
            method: "POST",
            show: (row) => row.paymentStatus !== "paid",
            form: {
              label: "Record payment",
              submitLabel: "Save payment",
              fields: [
                field("amount", "Amount", { type: "number", required: true, currency: true }),
                field("paymentMethod", "Payment method", { type: "select", options: ["cash", "transfer", "card", "cheque"], required: true }),
                field("paymentDate", "Payment date", { type: "date" }),
                field("reference", "Reference"),
                field("notes", "Notes", { type: "textarea" })
              ],
              validate: (values) => (
                values.paymentDate && new Date(values.paymentDate) > new Date()
                  ? "Payment date cannot be in the future."
                  : null
              ),
              transform: (values) => ({ ...values, amount: numeric(values.amount) })
            }
          },
          {
            label: "Assign",
            path: (row) => `/api/orders/${row._id}/assign`,
            method: "POST",
            form: {
              label: "Assign order",
              fields: [
                field("staffId", "Staff member", {
                  type: "lookup",
                  required: true,
                  lookup: {
                    path: "/api/orders/staff/available",
                    rows: (payload) => payload?.data || [],
                    value: (row) => row._id || row.id,
                    label: (row) => `${row.fullname} · ${row.position || "Staff"}`
                  }
                })
              ]
            }
          },
          { label: "Unassign", path: (row) => `/api/orders/${row._id}/unassign`, method: "POST", show: (row) => Boolean(row.assignedTo) },
          { label: "Receipt", path: (row) => `/api/orders/get-orders/${row._id}/receipt`, method: "GET", preview: true },
          { label: "Delete", path: (row) => `/api/orders/delete-orders/${row._id}`, method: "DELETE", danger: true }
        ]
      })
    ]
  },
  sales: {
    title: "Sales & Inventory",
    description: "Customer activity, revenue analytics and live inventory status.",
    resources: [
      resource("analytics", "Sales analytics", "/api/sales/get-sales", {
        view: "sales-analytics",
        query: { period: "monthly", startDate: "", endDate: "" },
        rows: (payload) => {
          const data = payload?.data || payload;
          return Array.isArray(data) ? data : Object.entries(data || {}).map(([metric, value]) => ({ metric, value }));
        },
        columns: [["metric", "Metric"], ["value", "Value", (value) => typeof value === "number" ? value.toLocaleString() : JSON.stringify(value)]]
      }),
      resource("clients", "Clients", "/api/sales/get-clients", {
        rows: (payload) => payload?.data || [],
        columns: [
          ["clientName", "Client"],
          ["phoneNumber", "Phone"],
          ["email", "Email"],
          ["clientAddress", "Address"],
          ["nearestBusStop", "Nearest bus stop"]
        ]
      }),
      resource("inventory", "Inventory status", "/api/sales/get-inventory", {
        rows: (payload) => payload?.data || [],
        columns: [
          ["name", "Item"],
          ["quantity", "Quantity"],
          ["status", "Status", text, "status"],
          ["value", "Value", currency]
        ]
      })
    ]
  },
  invoices: {
    title: "Invoices",
    description: "Create invoices from quotations and track settlement.",
    resources: [
      resource("invoices", "Invoice register", "/api/invoices/invoices", {
        view: "cards",
        cardType: "invoices",
        query: { page: 1, limit: 100, search: "", status: "", paymentStatus: "" },
        rows: (payload) => payload?.data?.invoices || [],
        stats: [
          ["Invoices", (rows) => rows.length],
          ["Invoice value", (rows) => currency(rows.reduce((sum, row) => sum + (row.finalTotal || 0), 0))],
          ["Paid", (rows) => currency(rows.reduce((sum, row) => sum + (row.amountPaid || 0), 0))],
          ["Outstanding", (rows) => currency(rows.reduce((sum, row) => sum + (row.balance || 0), 0))]
        ],
        columns: [
          ["invoiceNumber", "Invoice"],
          ["clientName", "Client"],
          ["finalTotal", "Total", currency],
          ["amountPaid", "Paid", currency],
          ["balance", "Balance", currency],
          ["paymentStatus", "Payment", text, "status"],
          ["status", "Status", text, "status"],
          ["assignedTo.fullname", "Assigned to"],
          ["dueDate", "Due", date]
        ],
        create: {
          label: "Create invoice",
          path: "/api/invoices/create",
          fields: [
            field("quotationId", "Quotation", {
              type: "lookup",
              required: true,
              lookup: {
                path: "/api/quotation",
                query: { page: 1, limit: 100 },
                rows: (payload) => Array.isArray(payload?.data)
                  ? payload.data
                  : payload?.data?.data || payload?.data?.quotations || payload?.quotations || [],
                filter: (row) => !row.status || ["draft", "sent", "approved"].includes(String(row.status).toLowerCase()),
                value: (row) => row._id,
                label: (row) => `${row.quotationNumber} · ${row.clientName} · ${currency(row.finalTotal)}`
              }
            }),
            field("dueDate", "Due date", { type: "date" }),
            field("notes", "Notes", { type: "textarea" }),
            field("invoiceTemplate", "Invoice PDF template", {
              type: "template-choice",
              full: true,
              defaultValue: "classic",
              preferenceKey: "invoice-template",
              previewFrom: "quotationId",
              options: [
                { value: "classic", label: "Classic", description: "Clean formal invoice with standard sections." },
                { value: "modern", label: "Modern", description: "Bold header and compact payment summary." },
                { value: "minimal", label: "Minimal", description: "Simple text-first PDF for quick sending." }
              ]
            })
          ]
        },
        rowActions: [
          {
            label: "Assign",
            path: (row) => `/api/invoices/${row._id}/assign`,
            method: "POST",
            form: {
              label: "Assign invoice",
              fields: [
                field("staffId", "Staff member", {
                  type: "lookup",
                  required: true,
                  lookup: {
                    path: "/api/orders/staff/available",
                    rows: (payload) => payload?.data || [],
                    value: (row) => row._id || row.id,
                    label: (row) => `${row.fullname} · ${row.position || "Staff"}`
                  }
                }),
                field("notes", "Assignment notes", { type: "textarea" })
              ]
            }
          },
          {
            label: "Update payment",
            path: (row) => `/api/invoices/${row._id}/payment`,
            method: "PATCH",
            show: (row) => row.paymentStatus !== "paid" && Boolean(row.assignedTo),
            form: {
              label: "Update invoice payment",
              fields: [
                field("amountPaid", "Total amount paid", { type: "number", required: true, currency: true }),
                field("notes", "Notes", { type: "textarea" })
              ],
              transform: (values) => ({ ...values, amountPaid: numeric(values.amountPaid) })
            }
          },
          { label: "Unassign", path: (row) => `/api/invoices/${row._id}/unassign`, method: "POST", show: (row) => Boolean(row.assignedTo) },
          { label: "Cancel", path: (row) => `/api/invoices/invoices/${row._id}/status`, method: "PATCH", body: () => ({ status: "cancelled" }), show: (row) => row.status !== "cancelled" },
          { label: "Delete", path: (row) => `/api/invoices/invoices/${row._id}`, method: "DELETE", danger: true }
        ]
      })
    ]
  },
  operations: {
    title: "Operations",
    description: "Overhead costs, notifications and company preferences.",
    resources: [
      resource("overheads", "Overhead costs", "/api/oc/get-oc", {
        rows: (payload) => payload?.data || payload?.overheadCosts || [],
        columns: [
          ["description", "Description"],
          ["category", "Category"],
          ["period", "Period"],
          ["cost", "Cost", currency],
          ["createdAt", "Created", date]
        ],
        create: {
          label: "Add overhead",
          path: "/api/oc/create-oc",
          fields: [
            field("description", "Description", { required: true }),
            field("category", "Category", { type: "select", options: ["Depreciation", "Others", "Rent", "Salaries"], required: true }),
            field("period", "Period", { type: "select", options: ["Hourly", "Daily", "Weekly", "Monthly", "Yearly"], required: true }),
            field("cost", "Cost", { type: "number", required: true })
          ]
        },
        rowActions: [{ label: "Delete", path: (row) => `/api/oc/delete-oc/${row._id}`, method: "DELETE", danger: true }]
      }),
      resource("notifications", "Notifications", "/api/notifications", {
        query: { page: 1, limit: 100, unreadOnly: "" },
        rows: (payload) => payload?.data?.notifications || [],
        columns: [
          ["title", "Notification"],
          ["message", "Message"],
          ["performedByName", "Activity by"],
          ["isRead", "State", (value) => value ? "Read" : "Unread"],
          ["createdAt", "Date", date]
        ],
        toolbarActions: [{ label: "Mark all read", path: "/api/notifications/read-all", method: "PATCH" }],
        rowActions: [
          { label: "Mark read", path: (row) => `/api/notifications/${row._id}/read`, method: "PATCH", show: (row) => !row.isRead },
          { label: "Delete", path: (row) => `/api/notifications/${row._id}`, method: "DELETE", danger: true }
        ]
      }),
      resource("settings", "Settings", "/api/settings", {
        rows: (payload) => {
          const settings = payload?.data;
          return settings ? [
            { key: "cloudSyncEnabled", setting: "Cloud sync", enabled: settings.cloudSyncEnabled },
            { key: "autoBackupEnabled", setting: "Automatic backup", enabled: settings.autoBackupEnabled },
            ...Object.entries(settings.notifications || {}).map(([key, enabled]) => ({ key, setting: key.replace(/([A-Z])/g, " $1"), enabled, notification: true }))
          ] : [];
        },
        columns: [["setting", "Setting"], ["enabled", "Enabled", (value) => value ? "Yes" : "No"]],
        rowActions: [{
          label: "Toggle",
          path: "/api/settings",
          method: "PUT",
          body: (row) => row.notification
            ? { notifications: { [row.key]: !row.enabled } }
            : { [row.key]: !row.enabled }
        }]
      })
    ]
  },
  permissions: {
    title: "Staff Access",
    description: "All active company staff share the complete operational workspace.",
    resources: [
      resource("staff", "Permission matrix", "/api/auth/staff", {
        columns: [
          ["fullname", "Staff"],
          ["position", "Position"],
          ["role", "Role"],
          ["permissions.quotation", "Quotes", (value) => value ? "Yes" : "No"],
          ["permissions.products", "Products", (value) => value ? "Yes" : "No"],
          ["permissions.boms", "BOMs", (value) => value ? "Yes" : "No"],
          ["permissions.order", "Orders", (value) => value ? "Yes" : "No"],
          ["permissions.invoice", "Invoices", (value) => value ? "Yes" : "No"]
        ]
      })
    ]
  },
  database: {
    title: "Company Database",
    description: "A consolidated view of operational records owned by the active company.",
    resources: [
      resource("quotations", "Quotations", "/api/database/quotations", {
        query: { page: 1, limit: 100, search: "" },
        rows: (payload) => payload?.data?.data || payload?.data || [],
        columns: [["quotationNumber", "Quotation"], ["clientName", "Client"], ["finalTotal", "Total", currency], ["status", "Status", text, "status"], ["createdAt", "Created", date]]
      }),
      resource("boms", "BOMs", "/api/database/boms", {
        query: { page: 1, limit: 100, search: "" },
        rows: (payload) => payload?.data?.data || payload?.data || [],
        columns: [["bomNumber", "BOM"], ["name", "Name"], ["materialsCost", "Materials", currency], ["totalCost", "Total", currency], ["createdAt", "Created", date]]
      }),
      resource("clients", "Clients", "/api/database/clients", { columns: [["clientName", "Client"], ["phoneNumber", "Phone"], ["email", "Email"], ["address", "Address"]] }),
      resource("staff", "Staff", "/api/database/staff", {
        rows: (payload) => payload?.data?.data || payload?.data || [],
        columns: [["fullname", "Name"], ["email", "Email"], ["position", "Position"], ["role", "Role"], ["accessGranted", "Access", (value) => value === false ? "Revoked" : "Active"]]
      }),
      resource("products", "Products", "/api/database/products", {
        query: { page: 1, limit: 100, search: "" },
        rows: (payload) => payload?.data?.data || payload?.data || [],
        columns: [["name", "Product"], ["productId", "Code"], ["category", "Category"], ["status", "Status", text, "status"], ["createdAt", "Created", date]]
      }),
      resource("materials", "Materials", "/api/database/materials", {
        query: { page: 1, limit: 100, search: "", category: "", status: "" },
        rows: (payload) => payload?.data?.data || [],
        columns: [["name", "Material"], ["category", "Category"], ["subCategory", "Type"], ["status", "Status", text, "status"], ["unitPrice", "Price", currency]]
      }),
      resource("invoices", "Invoices", "/api/database/invoices", {
        query: { page: 1, limit: 100, search: "" },
        rows: (payload) => payload?.data?.data || payload?.data || [],
        columns: [["invoiceNumber", "Invoice"], ["clientName", "Client"], ["finalTotal", "Total", currency], ["balance", "Balance", currency], ["status", "Status", text, "status"]]
      }),
      resource("receipts", "Receipts", "/api/database/receipts", { rows: (payload) => payload?.data?.data || payload?.data || [], columns: [["receiptNumber", "Receipt"], ["clientName", "Client"], ["amount", "Amount", currency], ["createdAt", "Date", date]] }),
    ]
  },
  platform: {
    title: "Platform Administration",
    description: "Companies, global activity and product/material approval queues.",
    admin: true,
    resources: [
      resource("companies", "Companies", "/api/platform/companies", {
        query: { page: 1, limit: 50, search: "", isActive: "" },
        columns: [
          ["name", "Company"],
          ["owner.fullname", "Owner"],
          ["email", "Email"],
          ["stats.products", "Products"],
          ["stats.orders", "Orders"],
          ["stats.quotations", "Quotations"],
          ["stats.users", "Users"],
          ["isActive", "Status", (value) => value ? "Active" : "Inactive", "status"]
        ]
      }),
      resource("pending-products", "Product approvals", "/api/platform/products/pending", {
        query: { page: 1, limit: 50, companyName: "", category: "" },
        columns: [["image", "Image", (value) => value, "image"], ["name", "Product"], ["companyName", "Company"], ["category", "Category"], ["submittedBy.fullname", "Submitted by"], ["createdAt", "Submitted", date]],
        rowActions: [
          { label: "Approve", path: (row) => `/api/platform/products/${row._id}/approve`, method: "PATCH", body: () => ({ notes: "Approved from web dashboard" }) },
          { label: "Reject", path: (row) => `/api/platform/products/${row._id}/reject`, method: "PATCH", prompt: { name: "reason", label: "Rejection reason" }, body: (row, _, value) => ({ reason: value }), danger: true }
        ]
      }),
      resource("pending-materials", "Material approvals", "/api/platform/materials/pending", {
        query: { page: 1, limit: 50, companyName: "", category: "" },
        columns: [["image", "Image", (value) => value, "image"], ["name", "Material"], ["companyName", "Company"], ["category", "Category"], ["subCategory", "Type"], ["unit", "Unit"], ["createdAt", "Submitted", date]],
        bulkActions: [
          {
            label: "Approve selected",
            path: "/api/platform/materials/approve",
            method: "PATCH",
            confirm: (rows) => `Approve ${rows.length} selected material${rows.length === 1 ? "" : "s"}?`,
            body: (rows) => ({
              materialIds: rows.map((row) => row._id),
              notes: "Approved in bulk from web dashboard"
            })
          }
        ],
        rowActions: [
          { label: "Edit", materialEdit: true },
          { label: "Approve", path: (row) => `/api/platform/materials/${row._id}/approve`, method: "PATCH", body: () => ({ notes: "Approved from web dashboard" }) },
          { label: "Reject", path: (row) => `/api/platform/materials/${row._id}/reject`, method: "PATCH", prompt: { name: "reason", label: "Rejection reason" }, body: (row, _, value) => ({ reason: value }), danger: true }
        ]
      }),
      resource("all-products", "All products", "/api/platform/products/all", {
        query: { page: 1, limit: 50, search: "", status: "", companyName: "" },
        rows: (payload) => payload?.data?.products || payload?.data || [],
        columns: [["image", "Image", (value) => value, "image"], ["name", "Product"], ["companyName", "Company"], ["category", "Category"], ["status", "Status", text, "status"], ["createdAt", "Created", date]]
      })
    ]
  }
};

export const productNavigation = [
  ["auth", "Company & Staff"],
  ["materials", "Materials"],
  ["products", "Products"],
  ["quotations", "Quotations"],
  ["boms", "Build of Materials"],
  ["orders", "Orders"],
  ["sales", "Sales & Inventory"],
  ["invoices", "Invoices"],
  ["operations", "Operations"],
  ["permissions", "Permissions"],
  ["database", "Company Database"],
  ["platform", "Platform Admin", true]
];

export const getNestedValue = (object, path) => {
  if (!path) return undefined;
  return String(path).split(".").reduce((value, key) => value?.[key], object);
};
