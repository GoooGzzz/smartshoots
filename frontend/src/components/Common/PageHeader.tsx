import React from 'react';
import { Box, Typography } from '@mui/material';
import { keyframes } from '@emotion/react';

const popIn = keyframes`
  0% { transform: scale(0.4) rotate(-8deg); opacity: 0; }
  60% { transform: scale(1.08) rotate(2deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
`;

const slideFade = keyframes`
  0% { transform: translateX(-8px); opacity: 0; }
  100% { transform: translateX(0); opacity: 1; }
`;

const growLine = keyframes`
  0% { width: 0%; }
  100% { width: 100%; }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

interface PageHeaderProps {
  title: string;
  icon: React.ReactElement;
  color?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

// NEW: every page previously opened with a plain `<Typography variant="h4">`
// - functional, but static and inconsistent with the 3D/animated treatment
// the rest of the app (header bar, dashboard cards, progress gauges) now
// has. This gives every page the same "arrival" moment - an icon badge
// that pops in with a little overshoot, the title sliding in alongside
// it, and a gradient accent line that grows in underneath and keeps a
// slow shimmer running - without being distracting on a page you're
// looking at for more than a second or two (animations run once on
// mount, only the underline shimmer continues).
export default function PageHeader({ title, icon, color = '#C1522F', subtitle, action }: PageHeaderProps) {
  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.75 }}>
          <Box
            sx={{
              width: 46, height: 46, borderRadius: 2.5, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(145deg, ${color}, ${color}99)`,
              boxShadow: `0 8px 16px -6px ${color}88, inset 0 1px 1px rgba(255,255,255,0.5)`,
              animation: `${popIn} .5s cubic-bezier(.34,1.56,.64,1)`,
              transition: 'transform .25s ease',
              '&:hover': { transform: 'scale(1.08) rotate(-4deg)' },
            }}
          >
            {React.cloneElement(icon, { sx: { color: '#fff', fontSize: 24 } })}
          </Box>
          <Box sx={{ animation: `${slideFade} .45s ease .05s both` }}>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1.15 }}>{title}</Typography>
            {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
          </Box>
        </Box>
        {action}
      </Box>
      <Box
        sx={{
          mt: 1.25, height: 4, borderRadius: 2, maxWidth: 160,
          backgroundImage: `linear-gradient(90deg, ${color}, ${color}33, ${color}, ${color}33)`,
          backgroundSize: '200% 100%',
          animation: `${growLine} .6s ease .1s both, ${shimmer} 3.5s linear infinite`,
        }}
      />
    </Box>
  );
}
