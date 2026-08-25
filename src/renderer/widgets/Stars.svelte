<script lang="ts">
  import { ratingToStars, starsToRating } from '@shared/fields'

  // Ratings are stored 0-100 with NULL meaning unrated, which is not the same as 0 (§3.6).
  let { value = null, onchange }: { value?: number | null; onchange?: (v: number) => void } = $props()

  let hover = $state<number | null>(null)
  const stars = $derived(hover ?? ratingToStars(value) ?? 0)
</script>

<div
  class="stars"
  role="slider"
  tabindex="0"
  aria-label="Rating"
  aria-valuemin="0"
  aria-valuemax="5"
  aria-valuenow={ratingToStars(value) ?? 0}
  onmouseleave={() => (hover = null)}
>
  {#each [1, 2, 3, 4, 5] as n (n)}
    <button
      class:on={n <= stars}
      onmouseenter={() => (hover = n)}
      onclick={() => onchange?.(starsToRating(n))}
      aria-label="{n} star{n === 1 ? '' : 's'}"
    >★</button>
  {/each}
</div>

<style>
  .stars { display: flex; gap: 1px; }

  button {
    padding: 0;
    font-size: var(--font-size-md);
    line-height: 1;
    color: var(--rating-off);
    background: none;
    border: 0;
    cursor: pointer;
    transition: color var(--transition-fast);
  }

  button.on { color: var(--rating-on); }
  .stars:hover button.on { color: var(--rating-hover); }
</style>
