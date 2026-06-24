<script setup lang="ts">
// Password reset. Props are derived from the `password.reset_requested` event
// (plus `tw`, the shared brand Tailwind config injected by render.ts).
defineProps<{
  resetUrl: string;
  tw?: Record<string, unknown>;
}>();
</script>

<template>
  <ETailwind :config="tw">
    <EHtml lang="en">
      <EHead />
      <EPreview>Reset your Atlas password.</EPreview>
      <EBody class="bg-brand-bg font-sans py-[40px]">
        <EContainer
          class="bg-white rounded-[8px] border border-solid border-brand-border max-w-[480px] px-[32px] py-[32px]"
        >
          <EHeading class="text-brand-text text-[22px] font-bold m-0">
            Reset your password
          </EHeading>
          <EText class="text-brand-text text-[15px] leading-[24px]">
            We received a request to reset the password for your Atlas account.
            Click the button below to choose a new one. This link expires shortly.
          </EText>
          <ESection class="text-center my-[28px]">
            <EButton
              :href="resetUrl"
              class="bg-brand text-white rounded-[6px] px-[24px] py-[12px] text-[14px] font-semibold no-underline"
            >
              Reset password
            </EButton>
          </ESection>
          <EText class="text-brand-muted text-[13px] leading-[20px]">
            If the button doesn't work, copy and paste this link into your
            browser:
          </EText>
          <EText class="text-brand text-[13px] leading-[20px] break-all">
            <ELink :href="resetUrl" class="text-brand">{{ resetUrl }}</ELink>
          </EText>
          <EHr class="border-brand-border my-[24px]" />
          <EText class="text-brand-muted text-[12px]">
            If you didn't request a password reset, you can safely ignore this
            email — your password will stay the same.
          </EText>
        </EContainer>
      </EBody>
    </EHtml>
  </ETailwind>
</template>
