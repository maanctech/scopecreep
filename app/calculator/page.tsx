import { RoiCalculator } from "@/components/marketing/RoiCalculator";

export default function CalculatorPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="border-b border-audit-border pb-6">
        <h1 className="text-3xl font-semibold">Revenue leakage calculator</h1>
        <p className="mt-3 max-w-2xl text-sm/6 text-zinc-700">
          Estimate how much margin disappears when out-of-scope work is handled without
          a change order.
        </p>
      </section>
      <RoiCalculator />
    </div>
  );
}
