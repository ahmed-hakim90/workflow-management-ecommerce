import { AccountsTree } from "@/components/accounts/accounts-tree";
import { PageHeader } from "@/components/layout/page-header";

export default function AccountsPage() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <PageHeader
        title="Chart of Accounts"
        description="Manage the tenant accounting tree for assets, liabilities, equity, revenue, and expenses."
      />
      <AccountsTree />
    </div>
  );
}
