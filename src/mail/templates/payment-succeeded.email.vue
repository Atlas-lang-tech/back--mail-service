<script setup lang="ts">
// Payment receipt. Props are derived from the `billing.payment_succeeded` event
// (plus `tw`, the shared brand Tailwind config injected by render.ts).
defineProps<{
  invoiceNumber: string;
  amountFormatted: string;
  paidAt: string;
  tw?: Record<string, unknown>;
}>();
</script>

<template>
  <ETailwind :config="tw">
    <EHtml lang="en">
      <EHead />
      <EPreview>Your Atlas payment was successful.</EPreview>
      <EBody class="bg-brand-bg font-sans py-[40px]">
        <EContainer
          class="bg-white rounded-[8px] border border-solid border-brand-border max-w-[480px] px-[32px] py-[32px]"
        >
          <EHeading class="text-brand-text text-[22px] font-bold m-0">
            Payment received ✅
          </EHeading>
          <EText class="text-brand-text text-[15px] leading-[24px]">
            Thank you — we've successfully processed your payment. Here's your
            receipt.
          </EText>
          <ESection
            class="bg-brand-bg rounded-[6px] px-[20px] py-[16px] my-[20px]"
          >
            <ERow>
              <EColumn class="text-brand-muted text-[13px]">Invoice</EColumn>
              <EColumn
                class="text-brand-text text-[13px] font-semibold text-right"
              >
                {{ invoiceNumber }}
              </EColumn>
            </ERow>
            <ERow>
              <EColumn class="text-brand-muted text-[13px]">Amount</EColumn>
              <EColumn
                class="text-brand-text text-[13px] font-semibold text-right"
              >
                {{ amountFormatted }}
              </EColumn>
            </ERow>
            <ERow>
              <EColumn class="text-brand-muted text-[13px]">Date</EColumn>
              <EColumn
                class="text-brand-text text-[13px] font-semibold text-right"
              >
                {{ paidAt }}
              </EColumn>
            </ERow>
          </ESection>
          <EHr class="border-brand-border my-[24px]" />
          <EText class="text-brand-muted text-[12px]">
            This receipt was generated automatically. Reply to this email if you
            have any questions about your billing.
          </EText>
        </EContainer>
      </EBody>
    </EHtml>
  </ETailwind>
</template>
