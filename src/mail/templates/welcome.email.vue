<script setup lang="ts">
// Welcome + email verification. Props are the `user.registered` event payload
// (plus `tw`, the shared brand Tailwind config injected by render.ts).
defineProps<{
  name?: string;
  verifyUrl: string;
  tw?: Record<string, unknown>;
}>();
</script>

<template>
  <ETailwind :config="tw">
    <EHtml lang="en">
      <EHead />
      <EPreview>Welcome to Atlas — confirm your email to get started.</EPreview>
      <EBody class="bg-brand-bg font-sans py-[40px]">
        <EContainer
          class="bg-white rounded-[8px] border border-solid border-brand-border max-w-[480px] px-[32px] py-[32px]"
        >
          <EHeading class="text-brand-text text-[22px] font-bold m-0">
            Welcome{{ name ? `, ${name}` : '' }}! 👋
          </EHeading>
          <EText class="text-brand-text text-[15px] leading-[24px]">
            Thanks for signing up for Atlas. Please confirm your email address to
            activate your account.
          </EText>
          <ESection class="text-center my-[28px]">
            <EButton
              :href="verifyUrl"
              class="bg-brand text-white rounded-[6px] px-[24px] py-[12px] text-[14px] font-semibold no-underline"
            >
              Verify email
            </EButton>
          </ESection>
          <EText class="text-brand-muted text-[13px] leading-[20px]">
            If the button doesn't work, copy and paste this link into your
            browser:
          </EText>
          <EText class="text-brand text-[13px] leading-[20px] break-all">
            <ELink :href="verifyUrl" class="text-brand">{{ verifyUrl }}</ELink>
          </EText>
          <EHr class="border-brand-border my-[24px]" />
          <EText class="text-brand-muted text-[12px]">
            If you didn't create an Atlas account, you can safely ignore this
            email.
          </EText>
        </EContainer>
      </EBody>
    </EHtml>
  </ETailwind>
</template>
