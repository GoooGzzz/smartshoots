import { createTheme } from '@mui/material/styles';
export function createAtelierTheme(rtl:boolean) {
 return createTheme({
  direction:rtl?'rtl':'ltr',
  palette:{mode:'light',primary:{main:'#123C72',dark:'#08264D',light:'#3D6DA5',contrastText:'#FFFFFF'},secondary:{main:'#405A78'},background:{default:'#FFFFFF',paper:'#FFFFFF'},text:{primary:'#08264D',secondary:'#405A78',disabled:'#647C98'},divider:'#D6E1EE',success:{main:'#237249'},error:{main:'#AB2642'},warning:{main:'#886119'},info:{main:'#1B65A1'}},
  shape:{borderRadius:12},
  typography:{fontFamily:rtl?"'AtelierArabic', 'Cairo', Tahoma, sans-serif":"'Plus Jakarta Sans', Arial, sans-serif",h4:{fontWeight:800,letterSpacing:rtl?'normal':'-.035em',lineHeight:1.2},h5:{fontWeight:800,lineHeight:1.25},h6:{fontWeight:750,lineHeight:1.35},body1:{lineHeight:1.7},body2:{lineHeight:1.6},button:{textTransform:'none',fontWeight:700}},
  components:{MuiButton:{styleOverrides:{root:{textTransform:'none',borderRadius:8,minHeight:44,paddingInline:20},contained:{boxShadow:'none'}}},MuiCard:{styleOverrides:{root:{border:'1px solid #D6E1EE',boxShadow:'0 12px 28px -24px #08264d70',borderRadius:16}}},MuiPaper:{styleOverrides:{root:{backgroundImage:'none'}}},MuiOutlinedInput:{styleOverrides:{root:{borderRadius:8}}},MuiTableCell:{styleOverrides:{head:{background:'#F0F5FC',fontWeight:800},root:{borderColor:'#E0E8F2',paddingTop:16,paddingBottom:16}}},MuiChip:{styleOverrides:{root:{borderRadius:6,fontWeight:650}}}}
 });
}
