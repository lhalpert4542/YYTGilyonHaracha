# Joins the source pieces into ../public/index.html (or a path given as argument).
import os, sys
here = os.path.dirname(os.path.abspath(__file__))
p = lambda f: open(os.path.join(here, f), encoding='utf-8').read()
s = ''.join(p(f) for f in ['p1_head.html','p2_body.html','p3_core.js','p3b_cloud.js','p4_views.js','p5_assess.js','p6_reports.js','p7_settings.js'])
for k, f in [('__FAV__','fav.txt'),('__LOGO__','logo.txt'),('__LH__','lh.txt'),('__FONT__','font.txt')]:
    s = s.replace(k, p(f).strip())
out = sys.argv[1] if len(sys.argv)>1 else os.path.join(here, '..', 'public', 'index.html')
open(out, 'w', encoding='utf-8').write(s)
print(out, len(s))
