let SessionLoad = 1
let s:so_save = &g:so | let s:siso_save = &g:siso | setg so=0 siso=0 | setl so=-1 siso=-1
let v:this_session=expand("<sfile>:p")
doautoall SessionLoadPre
silent only
silent tabonly
cd ~/programming-projects/student_management_system
if expand('%') == '' && !&modified && line('$') <= 1 && getline(1) == ''
  let s:wipebuf = bufnr('%')
endif
let s:shortmess_save = &shortmess
set shortmess+=aoO
badd +1 ~/programming-projects/student_management_system
badd +80 README.md
badd +12 server/.env
badd +1 term://~/programming-projects/student_management_system//71801:/usr/bin/zsh
badd +25 server/src/config.js
badd +1 server/project_description.md
badd +1 server/package-lock.json
badd +9 server/package.json
argglobal
%argdel
$argadd ~/programming-projects/student_management_system
tabnew +setlocal\ bufhidden=wipe
tabnew +setlocal\ bufhidden=wipe
tabrewind
edit server/package.json
let s:save_splitbelow = &splitbelow
let s:save_splitright = &splitright
set splitbelow splitright
wincmd _ | wincmd |
vsplit
1wincmd h
wincmd w
let &splitbelow = s:save_splitbelow
let &splitright = s:save_splitright
wincmd t
let s:save_winminheight = &winminheight
let s:save_winminwidth = &winminwidth
set winminheight=0
set winheight=1
set winminwidth=0
set winwidth=1
exe 'vert 1resize ' . ((&columns * 79 + 89) / 179)
exe 'vert 2resize ' . ((&columns * 99 + 89) / 179)
argglobal
setlocal foldmethod=manual
setlocal foldexpr=0
setlocal foldmarker={{{,}}}
setlocal foldignore=#
setlocal foldlevel=0
setlocal foldminlines=1
setlocal foldnestmax=20
setlocal foldenable
silent! normal! zE
let &fdl = &fdl
let s:l = 9 - ((8 * winheight(0) + 19) / 38)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 9
normal! 031|
lcd ~/programming-projects/student_management_system
wincmd w
argglobal
if bufexists(fnamemodify("~/programming-projects/student_management_system/README.md", ":p")) | buffer ~/programming-projects/student_management_system/README.md | else | edit ~/programming-projects/student_management_system/README.md | endif
if &buftype ==# 'terminal'
  silent file ~/programming-projects/student_management_system/README.md
endif
balt ~/programming-projects/student_management_system/server/.env
setlocal foldmethod=manual
setlocal foldexpr=0
setlocal foldmarker={{{,}}}
setlocal foldignore=#
setlocal foldlevel=0
setlocal foldminlines=1
setlocal foldnestmax=20
setlocal foldenable
silent! normal! zE
let &fdl = &fdl
let s:l = 187 - ((33 * winheight(0) + 19) / 38)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 187
normal! 0
lcd ~/programming-projects/student_management_system
wincmd w
exe 'vert 1resize ' . ((&columns * 79 + 89) / 179)
exe 'vert 2resize ' . ((&columns * 99 + 89) / 179)
tabnext
edit ~/programming-projects/student_management_system/server/project_description.md
argglobal
setlocal foldmethod=manual
setlocal foldexpr=0
setlocal foldmarker={{{,}}}
setlocal foldignore=#
setlocal foldlevel=0
setlocal foldminlines=1
setlocal foldnestmax=20
setlocal foldenable
silent! normal! zE
let &fdl = &fdl
let s:l = 46 - ((35 * winheight(0) + 19) / 38)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 46
normal! 0
lcd ~/programming-projects/student_management_system
tabnext
argglobal
if bufexists(fnamemodify("term://~/programming-projects/student_management_system//71801:/usr/bin/zsh", ":p")) | buffer term://~/programming-projects/student_management_system//71801:/usr/bin/zsh | else | edit term://~/programming-projects/student_management_system//71801:/usr/bin/zsh | endif
if &buftype ==# 'terminal'
  silent file term://~/programming-projects/student_management_system//71801:/usr/bin/zsh
endif
balt ~/programming-projects/student_management_system/server/.env
setlocal foldmethod=manual
setlocal foldexpr=0
setlocal foldmarker={{{,}}}
setlocal foldignore=#
setlocal foldlevel=0
setlocal foldminlines=1
setlocal foldnestmax=20
setlocal foldenable
let s:l = 47 - ((0 * winheight(0) + 19) / 38)
if s:l < 1 | let s:l = 1 | endif
keepjumps exe s:l
normal! zt
keepjumps 47
normal! 029|
lcd ~/programming-projects/student_management_system
tabnext 1
if exists('s:wipebuf') && len(win_findbuf(s:wipebuf)) == 0 && getbufvar(s:wipebuf, '&buftype') isnot# 'terminal'
  silent exe 'bwipe ' . s:wipebuf
endif
unlet! s:wipebuf
set winheight=1 winwidth=20
let &shortmess = s:shortmess_save
let &winminheight = s:save_winminheight
let &winminwidth = s:save_winminwidth
let s:sx = expand("<sfile>:p:r")."x.vim"
if filereadable(s:sx)
  exe "source " . fnameescape(s:sx)
endif
let &g:so = s:so_save | let &g:siso = s:siso_save
set hlsearch
doautoall SessionLoadPost
unlet SessionLoad
" vim: set ft=vim :
