# Joins the source pieces into public/index.html.  Run: python3 src/build.py
import os
here = os.path.dirname(os.path.abspath(__file__))
p = lambda f: open(os.path.join(here, f), encoding='utf-8').read()
s = ''.join(p(f) for f in ['part1_head.html','part2_body.html','part3a_core.js','part3b_views.js','part3c_reports.js','part3d_settings.js'])
s = s.replace('__FAV__', p('fav.txt').strip()).replace('__LOGO__', p('logo.txt').strip()).replace('__LH__', p('lh.txt').strip())
open(os.path.join(here, '..', 'public', 'index.html'), 'w', encoding='utf-8').write(s)
print('public/index.html', len(s))
