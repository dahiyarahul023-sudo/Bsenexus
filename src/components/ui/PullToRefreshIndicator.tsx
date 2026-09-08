import React from 'react';

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isPulling: boolean;
  isRefreshing: boolean;
  progress: number;
  label?: string;
}

export function PullToRefreshIndicator({
  pullDistance,
  isPulling,
  isRefreshing,
  progress,
}: PullToRefreshIndicatorProps) {
  // Hide completely when 0 and not refreshing
  if (pullDistance <= 0 && !isRefreshing) return null;

  // Active display height with smooth spring
  const displayHeight = isRefreshing ? 48 : Math.max(0, pullDistance);
  const opacity = isRefreshing ? 1 : Math.min(1, progress * 1.2);
  const scale = isRefreshing ? 1 : Math.min(1, 0.4 + progress * 0.6);
  const rotation = isRefreshing ? undefined : `${progress * 240}deg`;

  return (
    <div
      className="flex items-center justify-center overflow-hidden w-full select-none pointer-events-none z-10"
      style={{
        height: `${displayHeight}px`,
        transition: isPulling ? 'none' : 'height 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease',
        opacity: opacity
      }}
    >
      <div 
        className="flex items-center justify-center py-2"
        style={{
          transform: `scale(${scale})`,
          transition: isPulling ? 'none' : 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)'
        }}
      >
        {/* Instagram / iOS Native 8-Blade Daisy Spinner */}
        <div 
          className={`relative w-6 h-6 text-slate-500 dark:text-zinc-400 ${isRefreshing ? 'animate-spin' : ''}`}
          style={{
            animationDuration: '750ms',
            transform: !isRefreshing && rotation ? `rotate(${rotation})` : undefined,
            transition: isPulling ? 'none' : 'transform 0.15s ease-out'
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = i * 45;
            // Opacity for each blade during refresh vs pull progress
            let bladeOpacity = 0.25;
            if (isRefreshing) {
              // Stepped fade around the circle (classic iOS / Instagram spinner look)
              bladeOpacity = 0.2 + (i / 7) * 0.8;
            } else {
              // Fill blades sequentially or with progressive brightness
              const bladeThreshold = i / 8;
              bladeOpacity = progress >= bladeThreshold ? Math.min(1, 0.3 + (progress - bladeThreshold) * 2.5) : 0.15;
            }

            return (
              <span
                key={i}
                className="absolute top-0 left-1/2 -ml-[1px] w-[2.2px] h-[5.5px] rounded-full bg-current origin-[50%_12px]"
                style={{
                  transform: `rotate(${angle}deg)`,
                  opacity: bladeOpacity,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
