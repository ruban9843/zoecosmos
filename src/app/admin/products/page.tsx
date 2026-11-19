import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import StatusPill from "../../../components/admin/StatusPill";
import ClickableRow from "../../../components/admin/ClickableRow";

import { formatMoney } from "../../../lib/currency";

const fmt = formatMoney;
const PAGE_SIZE = 50;
const FILTERS = [
  { key: "live", label: "Active & draft" },
  { key: "ACTIVE", label: "Active" },
  { key: "DRAFT", label: "Draft" },
  { key: "ARCHIVED", label: "Archived" },
  { key: "all", label: "All" },
] as const;

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.key === sp.status) ? sp.status! : "live";
  const page = Math.max(1, parseInt(sp.page || "1") || 1);
  const where =
    filter === "all" ? {} :
    filter === "live" ? { status: { not: "ARCHIVED" as const } } :
    { status: filter as "ACTIVE" | "DRAFT" | "ARCHIVED" };

  const [products, total, counts] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        category: true,
        _count: { select: { variants: true, orderItems: true } },
        variants: { select: { stockQty: true } },
        images: { orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }], take: 1, select: { url: true } },
      },
    }),
    prisma.product.count({ where }),
    prisma.product.groupBy({ by: ["status"], _count: true }),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="ad-page">
      <div className="ad-page-head">
        <div className="ad-page-head-text">
          <span className="ad-eyebrow">Catalog</span>
          <h1 className="ad-h1">Products</h1>
          <p className="ad-h1-sub">
            {countOf("ACTIVE")} live · {countOf("DRAFT")} draft · {countOf("ARCHIVED")} archived
          </p>
        </div>
        <div className="ad-actions">
          <Link href="/admin/products/new" className="ad-btn ad-btn--dark">
            + New product
          </Link>
        </div>
      </div>

      <div className="ad-tabs" role="tablist" aria-label="Filter products">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/admin/products?status=${f.key}`}
            role="tab"
            aria-selected={filter === f.key}
            className={"ad-tab" + (filter === f.key ? " ad-tab--on" : "")}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>SKU</th>
              <th>Category</th>
              <th style={{ textAlign: "right" }}>Price</th>
              <th style={{ textAlign: "right" }}>Stock</th>
              <th style={{ textAlign: "right" }}>Sales</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p: any) => {
              const stock = p.variants.reduce(
                (s: number, v: any) => s + v.stockQty,
                0,
              );
              const palette = (p.palette as string[]) || [];
              return (
                <ClickableRow key={p.id} href={`/admin/products/${p.slug}`}>
                  <td>
                    <div
                      style={{ display: "flex", gap: 10, alignItems: "center" }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 46,
                          borderRadius: 6,
                          flexShrink: 0,
                          overflow: "hidden",
                          background: `linear-gradient(135deg, ${palette[0] || "#eee"}55, ${palette[2] || "#ccc"}33)`,
                        }}
                      >
                        {p.images[0]?.url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.images[0].url} alt="" width={36} height={46} loading="lazy" style={{ width: 36, height: 46, objectFit: "cover", display: "block" }} />
                        )}
                      </div>
                      <span
                        style={{
                          fontFamily: "var(--font-serif), serif",
                          fontSize: 16,
                          fontWeight: 500,
                        }}
                      >
                        {p.name}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className="ad-table-id">{p.sku}</span>
                  </td>
                  <td>{p.category?.name || "—"}</td>
                  <td className="ad-table-money">{fmt(p.basePrice)}</td>
                  <td
                    style={{
                      textAlign: "right",
                      fontFamily: "var(--font-mono), monospace",
                      color: stock === 0 ? "var(--ad-warn)" : "inherit",
                    }}
                  >
                    {stock}
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      fontFamily: "var(--font-mono), monospace",
                    }}
                  >
                    {p._count.orderItems}
                  </td>
                  <td>
                    <StatusPill
                      status={
                        p.status === "ACTIVE"
                          ? stock === 0
                            ? "draft"
                            : stock <= 6
                              ? "new"
                              : "ready"
                          : p.status
                      }
                    />
                  </td>
                </ClickableRow>
              );
            })}
          </tbody>
        </table>
      </div>
      {products.length === 0 && <p className="ad-hint" style={{ padding: 16 }}>No products in this view.</p>}
      {pages > 1 && (
        <div className="ad-pager">
          {page > 1 && <Link className="ad-btn ad-btn--sm" href={`/admin/products?status=${filter}&page=${page - 1}`}>← Prev</Link>}
          <span>Page {page} of {pages}</span>
          {page < pages && <Link className="ad-btn ad-btn--sm" href={`/admin/products?status=${filter}&page=${page + 1}`}>Next →</Link>}
        </div>
      )}
    </div>
  );
}
