"""Contrast + distinguishability verification for the timetable design palette.
Run: python3 contrast_check.py   (no dependencies)"""
import math, itertools

def hex2rgb(h): h=h.lstrip('#'); return [int(h[i:i+2],16)/255 for i in (0,2,4)]
def lin(c): return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def lum(h): r,g,b=[lin(c) for c in hex2rgb(h)]; return 0.2126*r+0.7152*g+0.0722*b
def cr(a,b):
    la,lb=sorted([lum(a),lum(b)],reverse=True); return (la+0.05)/(lb+0.05)
def to_lab(h):
    r,g,b=[lin(c) for c in hex2rgb(h)]
    x=(0.4124*r+0.3576*g+0.1805*b)/0.95047; y=0.2126*r+0.7152*g+0.0722*b; z=(0.0193*r+0.1192*g+0.9505*b)/1.08883
    f=lambda t: t**(1/3) if t>0.008856 else 7.787*t+16/116
    return (116*f(y)-16, 500*(f(x)-f(y)), 200*(f(y)-f(z)))
def de2000(l1,l2):
    L1,a1,b1=l1;L2,a2,b2=l2
    C1=math.hypot(a1,b1);C2=math.hypot(a2,b2);Cb=(C1+C2)/2
    G=0.5*(1-math.sqrt(Cb**7/(Cb**7+25**7)))
    a1p,a2p=(1+G)*a1,(1+G)*a2
    C1p,C2p=math.hypot(a1p,b1),math.hypot(a2p,b2)
    h1p=math.degrees(math.atan2(b1,a1p))%360;h2p=math.degrees(math.atan2(b2,a2p))%360
    dL=L2-L1;dC=C2p-C1p
    dh=h2p-h1p
    if C1p*C2p==0: dh=0
    elif dh>180: dh-=360
    elif dh<-180: dh+=360
    dH=2*math.sqrt(C1p*C2p)*math.sin(math.radians(dh/2))
    Lbp=(L1+L2)/2;Cbp=(C1p+C2p)/2
    if C1p*C2p==0: hbp=h1p+h2p
    elif abs(h1p-h2p)<=180: hbp=(h1p+h2p)/2
    elif h1p+h2p<360: hbp=(h1p+h2p+360)/2
    else: hbp=(h1p+h2p-360)/2
    T=1-0.17*math.cos(math.radians(hbp-30))+0.24*math.cos(math.radians(2*hbp))+0.32*math.cos(math.radians(3*hbp+6))-0.20*math.cos(math.radians(4*hbp-63))
    dth=30*math.exp(-((hbp-275)/25)**2);Rc=2*math.sqrt(Cbp**7/(Cbp**7+25**7))
    Sl=1+0.015*(Lbp-50)**2/math.sqrt(20+(Lbp-50)**2);Sc=1+0.045*Cbp;Sh=1+0.015*Cbp*T
    Rt=-math.sin(math.radians(2*dth))*Rc
    return math.sqrt((dL/Sl)**2+(dC/Sc)**2+(dH/Sh)**2+Rt*(dC/Sc)*(dH/Sh))
# Machado et al. 2009, severity 1.0, applied in linear RGB
DEUT=[[0.367322,0.860646,-0.227968],[0.280085,0.672501,0.047413],[-0.011820,0.042940,0.968881]]
PROT=[[0.152286,1.052583,-0.204868],[0.114503,0.786281,0.099216],[-0.003882,-0.048116,1.051998]]
def sim(h,M):
    v=[lin(c) for c in hex2rgb(h)]
    o=[max(0,min(1,sum(M[i][j]*v[j] for j in range(3)))) for i in range(3)]
    g=lambda c: 12.92*c if c<=0.0031308 else 1.055*c**(1/2.4)-0.055
    return '#'+''.join('%02x'%round(g(c)*255) for c in o)

WHITE='#FFFFFF'
NEUTRAL={ '0':'#FFFFFF','25':'#FBFCFD','50':'#F6F7F9','100':'#EEF0F3','200':'#E1E4E9','300':'#CDD2D9',
  '400':'#7E8693','500':'#687180','600':'#4F5764','700':'#3D444F','800':'#2A3039','900':'#1A1F27','950':'#0E1117'}
PRIMARY={'50':'#EEF4FF','100':'#DCE8FF','200':'#BCD2FE','300':'#8DB2FB','400':'#5B8BF5','500':'#3B6DEB',
  '600':'#2556D6','700':'#1D44B0','800':'#1C3A8C','900':'#1B326F','950':'#131F44'}
SEM={
 'success':{'bg':'#ECFDF3','border':'#3F9A62','solid':'#15803D','text':'#166534'},
 'warning':{'bg':'#FFF8E6','border':'#A97A0B','solid':'#B45309','text':'#92400E'},
 'error':  {'bg':'#FEF1F1','border':'#E05A5A','solid':'#C62828','text':'#A61B1B'},
 'info':   {'bg':'#EAF6FB','border':'#3A93BA','solid':'#0369A1','text':'#075985'},
}
# Subject chip palette: bg (chip fill), fg (text), accent (4px inline-start stripe + legend swatch)
SUBJECTS=[
 ('blue',   'כחול',  '#DBEAFE','#1E3A8A','#2563EB'),
 ('green',  'ירוק',  '#D7F5E0','#14532D','#138A3F'),
 ('amber',  'ענבר',  '#FEF0C7','#713F12','#B86A04'),
 ('violet', 'סגול',  '#EDE4FF','#4C1D95','#7C3AED'),
 ('rose',   'ורוד',  '#FFE1E7','#881337','#E11D48'),
 ('teal',   'טורקיז','#CCF5EE','#134E4A','#0B8278'),
 ('orange', 'כתום',  '#FFE4CC','#7C2D12','#D14A08'),
 ('fuchsia','פוקסיה','#FAE0FB','#701A75','#C026D3'),
 ('lime',   'ליים',  '#E6F5C4','#365314','#568A0B'),
 ('sky',    'תכלת',  '#D5EFFC','#0C4A6E','#0284C7'),
 ('indigo', 'אינדיגו','#E0E4FF','#312E81','#4F46E5'),
 ('stone',  'חום',   '#EDE5DC','#44342A','#8A6A52'),
]
out=[]
def row(*c): out.append('| '+' | '.join(str(x) for x in c)+' |')
out.append('## Neutral ramp (contrast vs #FFFFFF / vs neutral-50 #F6F7F9)'); row('step','hex','vs white','vs n-50','vs n-100'); row(*['---']*5)
for k,v in NEUTRAL.items(): row(k,v,'%.2f'%cr(v,WHITE),'%.2f'%cr(v,NEUTRAL['50']),'%.2f'%cr(v,NEUTRAL['100']))
out.append('\n## Primary ramp'); row('step','hex','vs white','white text on it','vs n-50'); row(*['---']*5)
for k,v in PRIMARY.items(): row(k,v,'%.2f'%cr(v,WHITE),'%.2f'%cr(WHITE,v),'%.2f'%cr(v,NEUTRAL['50']))
out.append('\n## Semantic'); row('role','bg','text','text on bg','text on white','solid','white on solid','border vs white','border vs bg'); row(*['---']*9)
for k,s in SEM.items(): row(k,s['bg'],s['text'],'%.2f'%cr(s['text'],s['bg']),'%.2f'%cr(s['text'],WHITE),s['solid'],'%.2f'%cr(WHITE,s['solid']),'%.2f'%cr(s['border'],WHITE),'%.2f'%cr(s['border'],s['bg']))
out.append('\n## Subject chips'); row('#','name','bg','fg','accent','fg on bg','accent vs white','accent vs bg','bg vs white','bg→gray L*'); row(*['---']*10)
for i,(n,he,bg,fg,ac) in enumerate(SUBJECTS,1):
    row(i,f'{n} / {he}',bg,fg,ac,'%.2f'%cr(fg,bg),'%.2f'%cr(ac,WHITE),'%.2f'%cr(ac,bg),'%.2f'%cr(bg,WHITE),'%.0f'%to_lab(bg)[0])
def mind(cols):
    best=(999,None)
    for (a,x),(b,y) in itertools.combinations(cols,2):
        d=de2000(to_lab(x),to_lab(y))
        if d<best[0]: best=(d,(a,b))
    return best
for label,idx in (('chip bg',2),('accent stripe',4)):
    cols=[(s[0],s[idx]) for s in SUBJECTS]
    for vis,M in (('normal',None),('deuteranopia',DEUT),('protanopia',PROT)):
        c2=[(n,sim(h,M) if M else h) for n,h in cols]
        d,p=mind(c2); out.append(f'- min pairwise ΔE2000 of {label} ({vis}): {d:.1f} between {p[0]} & {p[1]}')
# key UI pairs
out.append('\n## Key UI pairs')
pairs=[('Body text n-900 on white',NEUTRAL['900'],WHITE),('Body text n-900 on n-50 (app bg)',NEUTRAL['900'],NEUTRAL['50']),
('Muted text n-600 on white',NEUTRAL['600'],WHITE),('Muted text n-600 on n-100',NEUTRAL['600'],NEUTRAL['100']),
('Subtle text n-500 on white',NEUTRAL['500'],WHITE),('Subtle text n-500 on n-50',NEUTRAL['500'],NEUTRAL['50']),
('Control border n-400 vs white',NEUTRAL['400'],WHITE),('Control border n-400 vs n-50',NEUTRAL['400'],NEUTRAL['50']),
('Focus ring p-600 vs white',PRIMARY['600'],WHITE),('Focus ring p-600 vs n-50',PRIMARY['600'],NEUTRAL['50']),
('Primary btn: white on p-600',WHITE,PRIMARY['600']),('Primary btn hover: white on p-700',WHITE,PRIMARY['700']),
('Link p-700 on white',PRIMARY['700'],WHITE),('Selected nav: p-800 on p-50',PRIMARY['800'],PRIMARY['50']),
('Sidebar text n-700 on n-25',NEUTRAL['700'],NEUTRAL['25']),
('Destructive btn: white on error-solid',WHITE,SEM['error']['solid']),
('Drop valid: success-solid outline vs white',SEM['success']['solid'],WHITE),('Drop invalid: error-solid outline vs white',SEM['error']['solid'],WHITE),
('Tooltip: n-50 on n-900',NEUTRAL['50'],NEUTRAL['900']),
('Conflict ring error-solid vs chip blue bg','#C62828','#DBEAFE'),('Conflict ring error-solid vs chip rose bg','#C62828','#FFE1E7'),
('Conflict ring error-solid vs chip orange bg','#C62828','#FFE4CC'),
('Unavailable cell text n-600 on n-100 hatch',NEUTRAL['600'],NEUTRAL['100']),
('Unavailable cell text n-600 on n-200 hatch stripe',NEUTRAL['600'],NEUTRAL['200']),
('Unavailable cell text n-700 on n-200 hatch stripe',NEUTRAL['700'],NEUTRAL['200']),
('Conflict badge: white on error-600',WHITE,SEM['error']['solid']),
('Warning badge text warning-700 on warning-50',SEM['warning']['text'],SEM['warning']['bg']),
('Warning icon warning-600 vs white',SEM['warning']['solid'],WHITE),
('Stepper done icon success-600 vs white',SEM['success']['solid'],WHITE),
('Selected lesson ring p-700 vs grid cell white',PRIMARY['700'],WHITE),
('Availability ON cell: p-600 fill vs white bg (non-text)',PRIMARY['600'],WHITE),
('Availability ON check icon: white on p-600',WHITE,PRIMARY['600']),
('Print off-day fill #E6E6E6 with black text','#000000','#E6E6E6'),
('Hard badge: white on n-700',WHITE,NEUTRAL['700']),
('Soft badge: p-700 text on white (dashed p-600 border)',PRIMARY['700'],WHITE),
('Soft badge dashed border p-600 vs white',PRIMARY['600'],WHITE),
('Switch off track n-400 vs white',NEUTRAL['400'],WHITE),
('Hard-constraints panel text n-700 on n-100',NEUTRAL['700'],NEUTRAL['100']),
('Draft pill n-700 on n-100',NEUTRAL['700'],NEUTRAL['100']),
('Print light line #7E7E7E vs white','#7E7E7E',WHITE),
('Chip meta line (fg at full colour) worst case = amber fg on amber bg','#713F12','#FEF0C7'),
# v1.1 (PRODUCT_SPEC v0.5): blocks editor, planning sheet, bell schedule editor
('Hard block icon n-800 on n-100 hatch base',NEUTRAL['800'],NEUTRAL['100']),
('Hard block icon n-800 on n-300 hatch stripe',NEUTRAL['800'],NEUTRAL['300']),
('Hard block cell border n-500 vs white (non-text)',NEUTRAL['500'],WHITE),
('Soft block icon warning-700 on warning-50',SEM['warning']['text'],SEM['warning']['bg']),
('Soft block icon warning-700 on n-100 stripe',SEM['warning']['text'],NEUTRAL['100']),
('Soft block dotted outline warning-600 vs white (non-text)',SEM['warning']['solid'],WHITE),
('Active block ring p-600 vs n-300 hatch stripe (non-text)',PRIMARY['600'],NEUTRAL['300']),
('Planning cell: teacher-missing text error-700 on error-50',SEM['error']['text'],SEM['error']['bg']),
('Planning cell: dashed error-600 border vs white (non-text)',SEM['error']['solid'],WHITE),
('Planning cell: body text n-900 on highlight p-100',NEUTRAL['900'],PRIMARY['100']),
('Planning cell: muted n-600 on highlight p-100',NEUTRAL['600'],PRIMARY['100']),
('Planning grade row: n-700 on n-100',NEUTRAL['700'],NEUTRAL['100']),
('Planning empty dash n-500 on white',NEUTRAL['500'],WHITE),
('Bell editor: join connector p-600 vs white (non-text)',PRIMARY['600'],WHITE),
('Bell editor: break row text n-600 on n-50',NEUTRAL['600'],NEUTRAL['50']),
]
for n,a,b in pairs: out.append(f'- {n}: {a} on {b} = **{cr(a,b):.2f}:1**')
worst_err=min(cr('#C62828',s[2]) for s in SUBJECTS); out.append(f'- Conflict ring #C62828 vs ALL chip bgs: min {worst_err:.2f}:1')
worst_focus=min(cr(PRIMARY['700'],s[2]) for s in SUBJECTS); out.append(f'- Focus ring on chips (p-700 #1D44B0, offset over chip bg): min {worst_focus:.2f}:1')

# Greedy default assignment order: maximise the minimum CVD-safe ΔE among the first N subjects
def cvd_d(x,y):
    return min(de2000(to_lab(sim(x,M) if M else x),to_lab(sim(y,M) if M else y)) for M in (None,DEUT,PROT))
names=[s_[0] for s_ in SUBJECTS]; acc={s_[0]:s_[4] for s_ in SUBJECTS}; bgs={s_[0]:s_[2] for s_ in SUBJECTS}
order=['blue']
while len(order)<len(names):
    rest=[n for n in names if n not in order]
    nxt=max(rest,key=lambda n: min(cvd_d(acc[n],acc[o]) for o in order))
    order.append(nxt)
out.append('\n## Recommended assignment order (greedy, CVD-aware on accent)')
for k in range(2,13):
    sub=order[:k]; m=min(cvd_d(acc[a],acc[b]) for a,b in itertools.combinations(sub,2))
    out.append(f'- first {k}: {sub[-1]:8s} min worst-case ΔE (normal/deut/prot) = {m:.1f}')
out.append('Order: '+' → '.join(order))
print('\n'.join(out))
