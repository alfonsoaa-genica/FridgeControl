import { FC } from 'react';
import { Box, Divider, Drawer, Toolbar, Typography } from '@mui/material';

import fridgeLogo from '../../assets/fridgeControl.png';
import { PROJECT_NAME } from '../../api/env';
import LayoutMenu from './LayoutMenu';
import { DRAWER_WIDTH } from './Layout';

interface LayoutDrawerProps {
  mobileOpen: boolean;
  onClose: () => void;
}

const LayoutDrawer: FC<LayoutDrawerProps> = ({ mobileOpen, onClose }) => {
  const drawer = (
    <>
      <Toolbar disableGutters>
        <Box display="flex" alignItems="center" px={2} width="100%">
          <Box
            component="img"
            src={fridgeLogo}
            alt={PROJECT_NAME}
            sx={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              mr: 1.5,
              flexShrink: 0,
              boxShadow: '0 0 12px rgba(0, 229, 255, 0.35)'
            }}
          />
          <Typography variant="h6" color="textPrimary" fontWeight={700} noWrap sx={{ letterSpacing: '0.5px' }}>
            {PROJECT_NAME}
          </Typography>
        </Box>
        <Divider absolute />
      </Toolbar>
      <Divider />
      <LayoutMenu />
    </>
  );

  return (
    <Box
      component="nav"
      sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
    >
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onClose}
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
        }}
      >
        {drawer}
      </Drawer>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
        }}
        open
      >
        {drawer}
      </Drawer>
    </Box>
  );
};

export default LayoutDrawer;
