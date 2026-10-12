import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

/* THE CIVELLUM STUDIO. Supabase holds the data. Security is in schema.sql, not this file. */
const CFG = window.CIVELLUM_CONFIG || {};
const READY = /^https:\/\//.test(CFG.supabaseUrl||'') &&
  !!CFG.supabasePublishableKey && !CFG.supabasePublishableKey.includes('PASTE_');
const db = READY ? createClient(CFG.supabaseUrl,CFG.supabasePublishableKey) : null;
const $ = s => document.querySelector(s);
const app = $('#app');
const categories = ['Economics','Technology','Politics','Society','Culture','Opinion'];
let session = null, profile = null, admin = false, recovery = false;
let renderCounter = 0, noticeTimer = null;
$('#year').textContent = new Date().getFullYear();
$('#current-date').textContent = new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}).format(new Date()).toUpperCase();

const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = value => value ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value)) : '';
const words = value => (String(value||'').trim().match(/\S+/g)||[]).length;
const readtime = value => `${Math.max(1,Math.ceil(words(value)/210))} min read`;
const safeImg = url => {try {const u = new URL(url);return u.protocol === 'https:' ? u.href : '';} catch {return '';}};
const avatar = (p,size='') => `<span class="avatar ${size}">${safeImg(p?.avatar_url)?`<img src="${esc(safeImg(p.avatar_url))}" alt="" loading="lazy">`:esc((p?.display_name||p?.username||'W').trim().slice(0,1).toUpperCase())}</span>`;
const tag = text => `<span class="tag">${esc(text)}</span>`;
const empty = (heading,body,action='') => `<div class="empty-state"><h3>${esc(heading)}</h3><p class="muted">${esc(body)}</p>${action}</div>`;
const spinner = () => '<div class="skeleton tall"></div><div class="skeleton"></div>';
function notify(message,bad=false){const el=$('#flash');el.textContent=message;el.className='flash visible'+(bad?' error':'');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>el.classList.remove('visible'),5200);}
function failure(err){console.error(err);notify(err?.message||String(err)||'Something went wrong.',true);}
function replace(html){app.innerHTML=html;}
function goto(path){const h='#'+(path.startsWith('/')?path:'/'+path);if(location.hash===h)render();else location.hash=h;}
function routeInfo(){let value=location.hash.startsWith('#/')?location.hash.slice(1):'/';const q=value.indexOf('?');return {path:q<0?value:value.slice(0,q),params:new URLSearchParams(q<0?'':value.slice(q+1))};}
function requireAccount(){if(session)return true;notify('Please sign in to continue.');goto('/login');return false;}
function activeAccount(){if(!requireAccount())return false;if(profile?.is_suspended){notify('Your account is restricted from posting.',true);return false;}return true;}
async function result(q){const {data,error}=await q;if(error)throw error;return data;}
const ARTICLE_FIELDS='id,author_id,title,excerpt,body,category,cover_url,status,comments_enabled,created_at,updated_at,published_at,author:profiles!articles_author_id_fkey(id,username,display_name,avatar_url,is_suspended)';

async function refreshIdentity(){
 if(!db){session=null;profile=null;admin=false;return;}
 const {data:{session:s},error}=await db.auth.getSession();if(error)throw error;
 session=s;profile=null;admin=false;
 if(session){
   const [p,a]=await Promise.all([
     db.from('profiles').select('*').eq('id',session.user.id).maybeSingle(),
     db.from('admins').select('user_id').eq('user_id',session.user.id).maybeSingle()
   ]);
   if(p.error)throw p.error;if(a.error)throw a.error;
   profile=p.data;admin=!!a.data;
 }
 updateHeader();
}
function updateHeader(){
 $('#header-actions').innerHTML = session ? `
 <a href="#/bookmarks" class="btn ghost small" title="Saved stories">♡ Saved</a>
 <a href="#/me" class="btn ghost small">${esc(profile?.display_name||'My account')}</a>
 <a href="#/write" class="btn primary small">+ Write</a>` : `
 <a href="#/login" class="btn ghost small">Sign in</a>
 <a href="#/register" class="btn primary small">Join & write</a>`;
}
function photo(story,cls='story-cover'){
 const src=safeImg(story.cover_url);
 return src?`<img class="${cls}" src="${esc(src)}" loading="lazy" alt="Cover illustration for ${esc(story.title)}">`:`<div class="cover-fallback ${cls}" role="img" aria-label="Editorial placeholder for ${esc(story.category||'article')}"><span class="cover-kicker">THE CIVELLUM / ${esc(story.category||'JOURNALISM')}</span><span class="cover-rule"></span><span class="cover-monogram">C.</span></div>`;
}
function card(story,mode='grid'){
 const name=story.author?.display_name||'Civellum contributor';
 const link=`#/story/${encodeURIComponent(story.id)}`;
 if(mode==='mini')return `<div class="mini-story">${tag(story.category)}<h3><a href="${link}">${esc(story.title)}</a></h3><div class="meta">${esc(name)} · ${date(story.published_at||story.created_at)}</div></div>`;
 if(mode==='list')return `<article class="list-story"><div>${tag(story.category)}<h3><a href="${link}">${esc(story.title)}</a></h3><p>${esc(story.excerpt)}</p><div class="meta">By <a href="#/author/${esc(story.author_id)}">${esc(name)}</a> · ${date(story.published_at||story.created_at)} · ${readtime(story.body)}</div></div><a href="${link}">${photo(story)}</a></article>`;
 return `<article class="story-card"><a href="${link}">${photo(story)}</a><div class="head-kicker" style="margin-top:15px;margin-bottom:0">${tag(story.category)}</div><h3><a href="${link}">${esc(story.title)}</a></h3><p>${esc(story.excerpt)}</p><div class="meta">By <a href="#/author/${esc(story.author_id)}">${esc(name)}</a> · ${date(story.published_at||story.created_at)}</div></article>`;
}
function categoryPills(chosen='All'){return `<div class="filters">${['All',...categories].map(c=>`<a class="filter-pill ${chosen===c?'active':''}" href="#/explore${c==='All'?'':'?category='+encodeURIComponent(c)}">${esc(c)}</a>`).join('')}</div>`;}
async function queryPublished({category='',search='',limit=40}={}){
 let q=db.from('articles').select(ARTICLE_FIELDS).eq('status','published').order('published_at',{ascending:false}).limit(limit);
 if(category&&categories.includes(category))q=q.eq('category',category);
 if(search.trim())q=q.ilike('title','%'+search.trim().slice(0,70).replace(/[%_\\]/g,'')+'%');
 return (await result(q))||[];
}
function dateHero(){return `<div class="head-kicker"><span class="eyebrow">THE CIVELLUM / LATEST EDITION</span><span class="meta">Reader-powered. Independently minded.</span></div>`;}
async function home(){
 const articles=await queryPublished({limit:16});
 if(!articles.length)return `${dateHero()}<div class="hero-layout"><div class="lead-story"><div class="frontpage-rule"><span class="eyebrow">INDEPENDENT JOURNALISM / OPEN TO CONTRIBUTORS</span><span class="frontpage-rule-line"></span><span class="meta">THE FIRST EDITION</span></div><div class="eyebrow" style="margin-top:24px">WELCOME TO OUR FIRST EDITION</div><h1 class="feature-title">A new home for independent voices.</h1><p class="feature-desc">Thoughtful reporting, original perspectives and a space for writers who believe ideas deserve more than a headline.</p><a href="#/register" class="btn primary">Become a founding writer ↗</a></div><aside class="hero-aside"><div class="mini-story"><span class="tag">A NEW PUBLICATION</span><h3>Built for readers who ask better questions.</h3><p class="muted">Economics, technology, politics, culture and more.</p></div><div class="mini-story"><span class="tag">WRITE WITH US</span><h3>Have something worth saying?</h3><p class="muted">Create a free account and publish original reporting.</p></div></aside></div><div class="editorial-strip"><div><span class="eyebrow" style="color:#a5d3bd">YOUR BYLINE, YOUR IDEAS</span><h2>A publication made by its contributors.</h2><p>Start with a headline. Build your story. Publish to the world.</p></div><a class="btn" href="#/write">Start writing ↗</a></div>`;
 const [lead,...rest]=articles;
 return `${dateHero()}<div class="hero-layout"><section class="lead-story" style="padding:0">${safeImg(lead.cover_url)?`<a href="#/story/${lead.id}">${photo(lead,'featured-image')}</a>`:`<div class="frontpage-rule"><span class="eyebrow">FEATURED REPORT</span><span class="frontpage-rule-line"></span></div>`}<div class="eyebrow" style="margin-top:21px">FEATURED / ${esc(lead.category)}</div><h1 class="feature-title"><a href="#/story/${lead.id}">${esc(lead.title)}</a></h1><p class="feature-desc">${esc(lead.excerpt)}</p><div class="meta">By <a href="#/author/${lead.author_id}">${esc(lead.author?.display_name||'Contributor')}</a> · ${date(lead.published_at)} · ${readtime(lead.body)}</div></section><aside class="hero-aside">${rest.slice(0,4).map(a=>card(a,'mini')).join('')}</aside></div><div class="section-head"><h2>Latest perspectives</h2><a href="#/explore">Explore all stories →</a></div><div class="stories-grid">${rest.slice(4,10).map(a=>card(a)).join('')||rest.slice(0,3).map(a=>card(a)).join('')}</div><div class="editorial-strip"><div><span class="eyebrow" style="color:#a5d3bd">WRITE FOR THE CIVELLUM</span><h2>A new generation of independent voices.</h2><p>Start publishing and make your work part of the conversation.</p></div><a class="btn" href="#/write">Write a story ↗</a></div>`;
}
async function explore(params){
 const category=params.get('category')||'All';const search=params.get('q')||'';
 const articles=await queryPublished({category:category==='All'?'':category,search,limit:60});
 return `<section style="padding-top:0"><div class="eyebrow">DISCOVER THE CIVELLUM</div><div class="split-head"><h1 class="page-title">The latest stories</h1><span class="meta">${articles.length} stories shown</span></div><form class="searchbar" data-form="search"><span>⌕</span><input name="query" value="${esc(search)}" maxlength="70" placeholder="Search headlines..." aria-label="Search headlines"><button>Search ↗</button></form>${categoryPills(category)}<div class="columns"><div>${articles.length?articles.map(a=>card(a,'list')).join(''):empty('No stories found','Try another search or be the first writer to contribute.','<a href="#/write" class="btn primary">Write a story</a>')}</div><aside class="side-panel"><div class="aside-block"><span class="eyebrow">EDITORIAL NOTE</span><h2 style="font-size:23px;margin-top:10px">Ideas deserve evidence.</h2><p class="muted" style="font-size:13px">Every contributor is responsible for verifying claims, sourcing facts and respecting other writers.</p></div><a class="btn primary" href="#/write">+ Submit a story</a></aside></div></section>`;
}
function renderBody(text){
 return String(text||'').split(/\n\s*\n/).map(block=>{
 const safe=esc(block.trim());
 if(!safe)return '';
 if(safe.startsWith('## '))return `<h2>${safe.slice(3)}</h2>`;
 if(safe.startsWith('### '))return `<h3>${safe.slice(4)}</h3>`;
 if(safe.startsWith('&gt; '))return `<blockquote>${safe.slice(5).replaceAll('\n','<br>')}</blockquote>`;
 return `<p>${safe.replaceAll('\n','<br>')}</p>`;
 }).join('');
}
async function storyPage(id){
 const story=await result(db.from('articles').select(ARTICLE_FIELDS).eq('id',id).maybeSingle());
 if(!story)return empty('Story unavailable','This story may have been removed or the link is incorrect.','<a class="btn" href="#/explore">Browse stories</a>');
 const canEdit=story.author_id===session?.user?.id && story.status!=='hidden';
 const canReadComments=story.status==='published';
 const [comments,likeCount,myLike,myBookmark]=await Promise.all([
   canReadComments?result(db.from('comments').select('id,article_id,author_id,body,status,created_at,author:profiles!comments_author_id_fkey(id,username,display_name,avatar_url)').eq('article_id',id).eq('status','visible').order('created_at',{ascending:true}).limit(150)):Promise.resolve([]),
   db.rpc('article_like_count',{target_article:id}).then(r=>r.data??0),
   session?db.from('likes').select('user_id').eq('article_id',id).eq('user_id',session.user.id).maybeSingle().then(r=>r.data):Promise.resolve(null),
   session?db.from('bookmarks').select('user_id').eq('article_id',id).eq('user_id',session.user.id).maybeSingle().then(r=>r.data):Promise.resolve(null)
 ]);
 const statusNote=story.status!=='published'?`<div class="feature-note" style="margin:15px 0">This story is currently <strong>${esc(story.status)}</strong> and is not visible to the general public.</div>`:'';
 const controls=`<div class="reading-actions"><button class="btn ghost small" data-action="toggle-like" data-id="${esc(id)}">${myLike?'♥ Liked':'♡ Like'} · ${likeCount}</button><button class="btn ghost small" data-action="toggle-bookmark" data-id="${esc(id)}">${myBookmark?'★ Saved':'☆ Save'}</button><button class="btn ghost small" data-action="share" data-id="${esc(id)}">↗ Share</button>${canEdit?`<a class="btn ghost small" href="#/edit/${esc(id)}">✎ Edit</a>`:''}${session&&story.status==='published'?`<button class="btn ghost small" data-action="report" data-type="article" data-id="${esc(id)}">⚑ Report</button>`:''}</div>`;
 return `<article class="story-reading"><div class="eyebrow">${esc(story.category)} / ${date(story.published_at||story.created_at)}</div><h1 class="title">${esc(story.title)}</h1><p class="story-dek">${esc(story.excerpt)}</p>${statusNote}<div class="reading-meta">${avatar(story.author)}<div><a href="#/author/${esc(story.author_id)}" style="font-weight:800">${esc(story.author?.display_name||'Contributor')}</a><div class="meta">@${esc(story.author?.username||'writer')} · ${date(story.published_at||story.created_at)} · ${readtime(story.body)}</div></div></div>${story.cover_url?photo(story,'featured-image'):''}<div class="article-text" style="margin-top:35px">${renderBody(story.body)}</div><div class="subtle-line"></div>${controls}<div class="reading-comments"><div class="section-head"><h2>Discussion <span class="count">${comments.length}</span></h2></div>${!story.comments_enabled?'<p class="muted">Comments are closed for this article.</p>':!session?'<div class="form-help">Join the discussion. <a href="#/login"><strong>Sign in to comment →</strong></a></div>':profile?.is_suspended?'<p class="muted">Your account is restricted from commenting.</p>':`<form class="stack" data-form="comment" data-article="${esc(id)}"><label class="field">Add to the conversation<textarea name="body" rows="3" maxlength="1200" minlength="2" placeholder="Keep it constructive, respectful and relevant." required></textarea></label><div><button class="btn primary">Post comment ↗</button></div></form>`}<div style="margin-top:26px">${comments.map(c=>`<div class="comment"><div class="comment-top">${avatar(c.author)}<a href="#/author/${esc(c.author_id)}" style="font-weight:800">${esc(c.author?.display_name||'Contributor')}</a><span class="meta">${date(c.created_at)}</span></div><p>${esc(c.body)}</p><div class="comment-tools">${session&&c.author_id===session.user.id?`<button data-action="delete-comment" data-id="${esc(c.id)}">Delete</button>`:''}${session?`<button data-action="report" data-type="comment" data-id="${esc(c.id)}">Report</button>`:''}${admin?`<button data-action="hide-comment" data-id="${esc(c.id)}">Hide (moderator)</button>`:''}</div></div>`).join('')||'<p class="muted">No comments yet. Start the discussion.</p>'}</div></div></article>`;
}
async function authorPage(id){
 const [p,stories]=await Promise.all([
 result(db.from('profiles').select('id,username,display_name,bio,avatar_url,is_suspended,created_at').eq('id',id).maybeSingle()),
 result(db.from('articles').select(ARTICLE_FIELDS).eq('author_id',id).eq('status','published').order('published_at',{ascending:false}).limit(40))
 ]);
 if(!p)return empty('Writer not found','This profile does not exist.');
 return `<section style="padding:0"><div class="profile-hero">${avatar(p)}<div><span class="eyebrow">THE CIVELLUM / WRITER</span><h1>${esc(p.display_name)}</h1><p class="muted">@${esc(p.username)}</p><p>${esc(p.bio||'This writer has not added a biography yet.')}</p><div class="meta">Member since ${date(p.created_at)} · ${stories.length} published stories${p.is_suspended?' · Account restricted':''}</div></div></div><div class="section-head"><h2>Published by ${esc(p.display_name)}</h2></div><div class="stories-grid">${stories.map(card).join('')||'<p class="muted">No published stories.</p>'}</div></section>`;
}
function authForm(mode){
 const register=mode==='register',forgot=mode==='forgot';
 return `<section class="auth-box"><span class="eyebrow">YOUR CIVELLUM ACCOUNT</span><h1 class="page-title">${register?'Join the conversation':forgot?'Reset your password':'Welcome back'}</h1><p class="muted">${register?'Create a writer profile and publish your perspective.':forgot?'We will email you a secure password-reset link.':'Sign in to write, comment and save your favorite articles.'}</p><div class="form-panel"><form class="stack" data-form="${mode}"><label class="field">Email address<input name="email" type="email" required autocomplete="email" maxlength="254" placeholder="you@example.com"></label>${forgot?'':`<label class="field">Password<input name="password" type="password" required minlength="8" maxlength="128" autocomplete="${register?'new-password':'current-password'}" placeholder="At least 8 characters"></label>`}<button class="btn primary">${register?'Create account':forgot?'Send reset link':'Sign in'} ↗</button></form><hr class="subtle-line"><div class="quick-links">${register?'<a href="#/login">Already registered? Sign in →</a>':forgot?'<a href="#/login">← Back to sign in</a>':'<a href="#/register">Create an account →</a> · <a href="#/forgot">Forgot password?</a>'}</div></div><p class="hint" style="margin-top:13px">${register?'A confirmation email may be required before you can sign in. Use a personal email you control, and do not share passwords.':''}</p></section>`;
}
function resetPassword(){return `<section class="auth-box"><h1 class="page-title">Choose a new password</h1><div class="form-panel"><form data-form="reset-password" class="stack"><label class="field">New password<input type="password" name="password" minlength="8" maxlength="128" required autocomplete="new-password"></label><button class="btn primary">Update password</button></form></div></section>`;}
function writerForm(story=null){
 const isEdit=!!story;
 return `<section class="narrow"><div class="eyebrow">THE CIVELLUM / WRITER STUDIO</div><h1 class="page-title">${isEdit?'Edit your story':'Create a new story'}</h1><p class="muted">Tell a story that earns the reader's time. Drafts are private. Published articles go live immediately.</p><div class="form-panel"><form class="stack" id="editor-form" data-form="editor" data-id="${esc(story?.id||'')}"><label class="field">Headline<input name="title" maxlength="160" placeholder="A compelling, factual headline" value="${esc(story?.title||'')}"></label><div class="form-grid"><label class="field">Section<select name="category">${categories.map(c=>`<option ${story?.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></label><label class="field">Cover image (HTTPS link, optional)<input type="url" name="cover_url" placeholder="https://..." value="${esc(story?.cover_url||'')}"></label></div><label class="field">Standfirst / summary<textarea name="excerpt" rows="3" maxlength="320" placeholder="A concise summary readers will see below your headline.">${esc(story?.excerpt||'')}</textarea></label><label class="field">Your story<textarea name="body" class="editor-text" maxlength="60000" placeholder="Begin writing here.\n\nUse blank lines to separate paragraphs.\n\nStart a paragraph with ## for a section heading.">${esc(story?.body||'')}</textarea></label><label class="field" style="display:flex;align-items:center;flex-direction:row"><input type="checkbox" name="comments_enabled" ${story?.comments_enabled!==false?'checked':''} style="width:16px;height:16px"> Allow readers to comment</label><div class="form-help">To publish: headline ≥12 characters, summary ≥25 characters, body ≥200 characters. Drafts only need a headline. No HTML is accepted in articles.</div>${story?.status==='hidden'?'<p class="error-inline">This article was hidden by moderation and cannot be republished by its author.</p>':''}<div class="form-actions">${!story||story.status!=='hidden'?`<button type="submit" class="btn primary" name="mode" value="published">${story?.status==='published'?'Save published changes':'Publish now'} ↗</button><button type="button" class="btn ghost" data-action="save-draft">${story?.status==='published'?'Unpublish to draft':'Save as draft'}</button>`:''}<a href="#/me" class="btn ghost">Cancel</a></div></form></div></section>`;
}
async function dashboard(){
 const mine=await result(db.from('articles').select(ARTICLE_FIELDS).eq('author_id',session.user.id).order('updated_at',{ascending:false}).limit(100));
 const published=mine.filter(s=>s.status==='published').length,drafts=mine.filter(s=>s.status==='draft').length;
 return `<section style="padding-top:0"><div class="split-head"><div><div class="eyebrow">YOUR WRITER STUDIO</div><h1 class="page-title">My newsroom</h1><p class="muted">Manage your stories and develop your voice.</p></div><a href="#/write" class="btn primary">+ New story</a></div><div class="dash-stats"><div class="dash-stat"><strong>${mine.length}</strong><span>Total stories</span></div><div class="dash-stat"><strong>${published}</strong><span>Published</span></div><div class="dash-stat"><strong>${drafts}</strong><span>Drafts</span></div></div><div class="quick-links"><a class="btn ghost small" href="#/author/${esc(session.user.id)}">View public profile</a><a class="btn ghost small" href="#/settings">Account settings</a>${admin?'<a href="#/admin" class="btn ghost small">Moderation panel</a>':''}</div><div class="section-head"><h2>Your articles</h2></div>${mine.length?mine.map(a=>`<div class="row-card"><div>${tag(a.category)} <span class="state ${esc(a.status)}">${esc(a.status)}</span><h3>${esc(a.title)}</h3><div class="meta">Updated ${date(a.updated_at)} · ${words(a.body)} words</div></div><div class="actions"><a href="#/story/${esc(a.id)}" class="btn small ghost">View</a>${a.status!=='hidden'?`<a href="#/edit/${esc(a.id)}" class="btn small ghost">Edit</a>`:''}${a.status==='draft'?`<button data-action="delete-draft" data-id="${esc(a.id)}" class="btn small danger">Delete</button>`:''}</div></div>`).join(''):empty('Your blank page awaits','Write your first draft or publish a story today.','<a class="btn primary" href="#/write">Create a story</a>')}</section>`;
}
async function bookmarksPage(){
 const marks=await result(db.from('bookmarks').select('article_id,created_at').eq('user_id',session.user.id).order('created_at',{ascending:false}));
 if(!marks.length)return `<h1 class="page-title">Saved stories</h1>${empty('Nothing saved yet','Tap ☆ Save on an article to keep it here.','<a href="#/explore" class="btn primary">Explore stories</a>')}`;
 const rows=await result(db.from('articles').select(ARTICLE_FIELDS).in('id',marks.map(m=>m.article_id)).eq('status','published'));
 return `<div class="eyebrow">YOUR READING LIST</div><h1 class="page-title">Saved stories</h1><div class="columns"><div>${rows.map(a=>card(a,'list')).join('')}</div></div>`;
}
function settingsPage(){
 return `<section class="narrow"><div class="eyebrow">ACCOUNT / PERSONAL SPACE</div><h1 class="page-title">Settings</h1><div class="content-panel"><div class="split-head"><h2>Public profile</h2><a href="#/author/${session.user.id}" class="btn small ghost">View profile</a></div><form class="stack" data-form="settings"><label class="field">Display name<input name="display_name" maxlength="70" minlength="2" required value="${esc(profile?.display_name||'')}"></label><label class="field">Public username<input name="username" maxlength="25" minlength="3" required pattern="[a-z0-9_]{3,25}" value="${esc(profile?.username||'')}"></label><label class="field">Short bio<textarea name="bio" maxlength="600">${esc(profile?.bio||'')}</textarea></label><label class="field">Avatar image (HTTPS URL, optional)<input name="avatar_url" type="url" value="${esc(profile?.avatar_url||'')}" placeholder="https://..."></label><p class="hint">Your email address is not displayed publicly.</p><div><button class="btn primary">Save profile</button></div></form></div><div class="content-panel" style="margin-top:22px"><h2>Account & security</h2><p class="muted">Signed in as ${esc(session.user.email||'')}</p><form class="stack" data-form="change-password"><label class="field">Set a new password<input type="password" name="password" minlength="8" maxlength="128" autocomplete="new-password" required placeholder="At least 8 characters"></label><div><button class="btn ghost">Change password</button></div></form><hr class="subtle-line"><button class="btn danger" data-action="signout">Sign out →</button><p class="hint" style="margin-top:16px">To request account or content deletion, contact the editorial team. A self-service account deletion workflow is not included in this version.</p></div></section>`;
}
async function adminPage(){
 const [reports,articles,writers,comments]=await Promise.all([
 result(db.from('reports').select('id,reporter_id,article_id,comment_id,reason,details,status,created_at').order('created_at',{ascending:false}).limit(100)),
 result(db.from('articles').select('id,title,status,author_id,created_at').order('created_at',{ascending:false}).limit(100)),
 result(db.from('profiles').select('id,username,display_name,is_suspended,created_at').order('created_at',{ascending:false}).limit(80)),
 result(db.from('comments').select('id,body,status,article_id,author_id,created_at').order('created_at',{ascending:false}).limit(60))
 ]);
 return `<div class="eyebrow">EDITORS ONLY</div><h1 class="page-title">Editorial control room</h1><p class="muted">All moderation actions are verified by the database. Publication is automatic, so review this queue regularly.</p><div class="dash-stats"><div class="dash-stat"><strong>${reports.filter(r=>r.status==='open').length}</strong><span>Open reports</span></div><div class="dash-stat"><strong>${articles.filter(a=>a.status==='published').length}</strong><span>Recently published</span></div><div class="dash-stat"><strong>${writers.length}</strong><span>Accounts (latest 80)</span></div></div><div class="section-head"><h2>Reported content</h2></div><div class="table-scroll"><table class="moderate-table"><thead><tr><th>Reason</th><th>Target / details</th><th>State</th><th>Actions</th></tr></thead><tbody>${reports.map(r=>`<tr><td><strong>${esc(r.reason)}</strong><br>${date(r.created_at)}</td><td>${r.article_id?`<a href="#/story/${esc(r.article_id)}">Article ↗</a>`:`Comment ${esc(r.comment_id||'').slice(0,8)}…`}<br>${esc(r.details||'No details')}</td><td>${esc(r.status)}</td><td><button class="mini-btn" data-action="report-state" data-id="${esc(r.id)}" data-status="resolved">Resolve</button><button class="mini-btn" data-action="report-state" data-id="${esc(r.id)}" data-status="dismissed">Dismiss</button>${r.article_id?`<button class="mini-btn danger" data-action="story-status" data-id="${esc(r.article_id)}" data-status="hidden">Hide story</button>`:''}${r.comment_id?`<button class="mini-btn danger" data-action="hide-comment" data-id="${esc(r.comment_id)}">Hide comment</button>`:''}</td></tr>`).join('')||'<tr><td colspan="4">No reports yet.</td></tr>'}</tbody></table></div><div class="section-head"><h2>Recent articles</h2></div><div class="table-scroll"><table class="moderate-table"><thead><tr><th>Headline</th><th>State</th><th>Action</th></tr></thead><tbody>${articles.map(a=>`<tr><td><a href="#/story/${esc(a.id)}">${esc(a.title)}</a></td><td>${esc(a.status)}</td><td>${a.status==='published'?`<button class="mini-btn danger" data-action="story-status" data-id="${esc(a.id)}" data-status="hidden">Hide</button>`:a.status==='hidden'?`<button class="mini-btn" data-action="story-status" data-id="${esc(a.id)}" data-status="published">Restore</button>`:'Draft'}</td></tr>`).join('')}</tbody></table></div><div class="section-head"><h2>Recent comments</h2></div><div class="table-scroll"><table class="moderate-table"><thead><tr><th>Comment</th><th>State</th><th>Action</th></tr></thead><tbody>${comments.map(c=>`<tr><td>${esc(c.body.slice(0,130))}</td><td>${esc(c.status)}</td><td><button class="mini-btn ${c.status==='visible'?'danger':''}" data-action="comment-status" data-id="${esc(c.id)}" data-status="${c.status==='visible'?'hidden':'visible'}">${c.status==='visible'?'Hide':'Restore'}</button></td></tr>`).join('')}</tbody></table></div><div class="section-head"><h2>Writer accounts</h2></div><div class="table-scroll"><table class="moderate-table"><thead><tr><th>Writer</th><th>State</th><th>Action</th></tr></thead><tbody>${writers.map(p=>`<tr><td><a href="#/author/${esc(p.id)}">${esc(p.display_name)} · @${esc(p.username)}</a></td><td>${p.is_suspended?'Suspended':'Active'}</td><td>${p.id===session.user.id?'Your account':`<button class="mini-btn ${p.is_suspended?'':'danger'}" data-action="suspend-writer" data-id="${esc(p.id)}" data-suspend="${p.is_suspended?'false':'true'}">${p.is_suspended?'Restore':'Suspend'}</button>`}</td></tr>`).join('')}</tbody></table></div>`;
}
function aboutPage(){return `<div class="narrow"><div class="eyebrow">OUR MISSION</div><h1 class="display">Independent voices.<br>Informed perspectives.</h1><p class="story-dek" style="margin-top:23px">The Civellum is a reader-powered publication for people who care about evidence, ideas and the world beyond the headlines.</p><div class="subtle-line"></div><h2>How it works</h2><p class="read-empty">Writers create a profile and publish articles under their own bylines. Readers explore work across economics, technology, politics, society and culture. Registered readers can comment, save, and report articles. Moderators can hide harmful contributions and restrict abusive accounts.</p><h2>Editorial standards</h2><p class="read-empty">Be accurate, attribute your sources, clearly distinguish fact from opinion, and respect intellectual property. Avoid publishing private information about other people, defamatory allegations, threats or harassment. Writers retain responsibility for their own claims. Publication is not editorial endorsement.</p><h2>A note on community safety</h2><p class="read-empty">This platform is in development and relies on human moderation. If you are under 18, avoid sharing personal contact details or identifying information publicly and involve a trusted adult where appropriate.</p><a class="btn primary" href="#/write">Contribute a story ↗</a></div>`;}

async function render(){
 const current=++renderCounter;
 const {path,params}=routeInfo();
 document.querySelectorAll('[data-route]').forEach(a=>a.classList.toggle('active',a.dataset.route===path));
 if(!db){replace(`<section class="narrow"><div class="eyebrow">SETUP REQUIRED</div><h1 class="page-title">The Civellum Studio is ready to connect.</h1><p class="muted">The design is installed, but accounts and articles require Supabase. Complete <strong>config.js</strong> and run the SQL in your new Supabase project.</p><div class="form-help">No live account has been created and no database is connected yet. Read README.md before inviting contributors.</div><a href="#/about" class="btn ghost" style="margin-top:20px">About the project</a></section>`);return;}
 replace(spinner());
 try{
  let html='';
  if(path==='/'||path==='/home')html=await home();
  else if(path==='/explore')html=await explore(params);
  else if(path.startsWith('/story/'))html=await storyPage(path.split('/')[2]);
  else if(path.startsWith('/author/'))html=await authorPage(path.split('/')[2]);
  else if(path==='/about')html=aboutPage();
  else if(path==='/login'||path==='/register'||path==='/forgot')html=session?await dashboard():authForm(path.slice(1));
  else if(path==='/reset')html=recovery||session?resetPassword():authForm('forgot');
  else if(path==='/write'){if(!requireAccount())return;html=writerForm();}
  else if(path.startsWith('/edit/')){if(!requireAccount())return;const a=await result(db.from('articles').select('*').eq('id',path.split('/')[2]).maybeSingle());html=(a&&a.author_id===session.user.id)?writerForm(a):empty('Cannot edit this story','Only the original author can edit their story.');}
  else if(path==='/me'){if(!requireAccount())return;html=await dashboard();}
  else if(path==='/bookmarks'){if(!requireAccount())return;html=await bookmarksPage();}
  else if(path==='/settings'){if(!requireAccount())return;html=settingsPage();}
  else if(path==='/admin'){if(!requireAccount())return;html=admin?await adminPage():empty('Access denied','Only the editorial administrators can open this page.');}
  else html=empty('Page not found','That page does not exist.','<a class="btn" href="#/">Return home</a>');
  if(current!==renderCounter)return;
  replace(html);
  if(path!=='/settings')app.scrollIntoView({block:'start'});
 }catch(e){if(current!==renderCounter)return;failure(e);replace(empty('Something went wrong','Please reload or check your Supabase setup.'));}
}

async function saveArticle(form,mode){
 if(!activeAccount())return;
 const data=new FormData(form);let title=String(data.get('title')||'').trim();
 if(!title && mode==='draft')title='Untitled';
 const obj={title,category:String(data.get('category')),excerpt:String(data.get('excerpt')||'').trim(),body:String(data.get('body')||'').trim(),cover_url:safeImg(String(data.get('cover_url')||''))||null,comments_enabled:data.has('comments_enabled'),status:mode};
 if(data.get('cover_url')&&!obj.cover_url)return notify('Cover image must be a valid HTTPS URL.',true);
 if(mode==='published'&&(title.length<12||obj.excerpt.length<25||obj.body.length<200))return notify('To publish: at least 12 headline characters, 25 summary characters and 200 body characters.',true);
 if(title.length>160||obj.excerpt.length>320||obj.body.length>60000)return notify('Your article exceeds a length limit.',true);
 const id=form.dataset.id;
 let saved;
 if(id){saved=await result(db.from('articles').update(obj).eq('id',id).select('id').single());}
 else saved=await result(db.from('articles').insert({...obj,author_id:session.user.id}).select('id').single());
 notify(mode==='published'?'Story published!':'Draft saved.');goto(mode==='published'?`/story/${saved.id}`:'/me');
}
async function toggleRow(table,id){
 if(!activeAccount())return;
 const user_id=session.user.id;
 const existing=await result(db.from(table).select('user_id').eq('article_id',id).eq('user_id',user_id).maybeSingle());
 if(existing)await result(db.from(table).delete().eq('article_id',id).eq('user_id',user_id));
 else await result(db.from(table).insert({article_id:id,user_id}));
 await render();
}
async function handleAction(el){
 const action=el.dataset.action,id=el.dataset.id;
 if(action==='save-draft')return saveArticle($('#editor-form'),'draft');
 if(action==='signout'){await result(db.auth.signOut());session=null;profile=null;admin=false;updateHeader();notify('You have signed out.');return goto('/');}
 if(action==='toggle-like')return toggleRow('likes',id);
 if(action==='toggle-bookmark')return toggleRow('bookmarks',id);
 if(action==='share'){
  const url=new URL(window.location.href);url.hash=`/story/${id}`;
  if(navigator.share){try{await navigator.share({title:'The Civellum',url:url.href});}catch{}return;}
  try{await navigator.clipboard.writeText(url.href);notify('Story link copied.');}catch{notify('Copy this link: '+url.href);}
  return;
 }
 if(action==='delete-draft'){
  if(!confirm('Delete this draft permanently?'))return;
  await result(db.from('articles').delete().eq('id',id).eq('author_id',session.user.id).eq('status','draft'));notify('Draft deleted.');return render();
 }
 if(action==='delete-comment'){
  if(!confirm('Delete your comment?'))return;
  await result(db.from('comments').delete().eq('id',id).eq('author_id',session.user.id));notify('Comment deleted.');return render();
 }
 if(action==='report'){
  if(!requireAccount())return;
  $('#report-target-id').value=id;$('#report-target-type').value=el.dataset.type;
  $('#report-dialog').showModal();return;
 }
 if(action==='close-report'){$('#report-dialog').close();return;}
 if(action==='submit-report'){
  if(!activeAccount())return;
  const form=$('#report-dialog form');const data=new FormData(form);
  const row={reporter_id:session.user.id,reason:data.get('reason'),details:String(data.get('details')||'').trim(),article_id:data.get('target-type')==='article'?data.get('target-id'):null,comment_id:data.get('target-type')==='comment'?data.get('target-id'):null};
  await result(db.from('reports').insert(row));$('#report-dialog').close();form.reset();notify('Report sent to the editorial moderators.');return;
 }
 if(!admin)return notify('Moderator access required.',true);
 if(action==='hide-comment'||action==='comment-status'){
  await result(db.from('comments').update({status:action==='hide-comment'?'hidden':el.dataset.status}).eq('id',id));notify('Comment moderation updated.');return render();
 }
 if(action==='story-status'){
  const status=el.dataset.status;
  if(status==='hidden'&&!confirm('Hide this article from readers?'))return;
  await result(db.from('articles').update({status}).eq('id',id));notify('Article moderation updated.');return render();
 }
 if(action==='report-state'){
  await result(db.from('reports').update({status:el.dataset.status}).eq('id',id));notify('Report updated.');return render();
 }
 if(action==='suspend-writer'){
  const suspend=el.dataset.suspend==='true';
  if(suspend&&!confirm('Suspend this writer from posting, commenting and saving?'))return;
  await result(db.rpc('moderate_writer',{target_user:id,suspend}));notify('Writer status updated.');return render();
 }
}

async function handleForm(form,event){
 const type=form.dataset.form, data=new FormData(form);
 if(type==='search'){return goto('/explore?q='+encodeURIComponent(String(data.get('query')||'').trim()));}
 if(type==='login'){
  await result(db.auth.signInWithPassword({email:String(data.get('email')).trim(),password:String(data.get('password'))}));
  await refreshIdentity();notify('Welcome back.');goto('/me');return;
 }
 if(type==='register'){
  const email=String(data.get('email')).trim();
  await result(db.auth.signUp({email,password:String(data.get('password')),options:{emailRedirectTo:location.origin+location.pathname}}));
  notify('Registration submitted. Check your email to confirm your account.');
  goto('/login');return;
 }
 if(type==='forgot'){
  await result(db.auth.resetPasswordForEmail(String(data.get('email')).trim(),{redirectTo:location.origin+location.pathname}));
  notify('If your email is registered, you will receive a reset link.');return;
 }
 if(type==='reset-password'){
  await result(db.auth.updateUser({password:String(data.get('password'))}));recovery=false;notify('Password updated.');goto('/settings');return;
 }
 if(type==='change-password'){
  await result(db.auth.updateUser({password:String(data.get('password'))}));notify('Password updated.');form.reset();return;
 }
 if(type==='editor'){
  const button=event.submitter;return saveArticle(form,button?.value==='published'?'published':'draft');
 }
 if(type==='comment'){
  if(!activeAccount())return;
  await result(db.from('comments').insert({article_id:form.dataset.article,author_id:session.user.id,body:String(data.get('body')).trim()}));notify('Comment posted.');return render();
 }
 if(type==='settings'){
  if(!activeAccount())return;
  const obj={display_name:String(data.get('display_name')).trim(),username:String(data.get('username')).trim().toLowerCase(),bio:String(data.get('bio')||'').trim(),avatar_url:safeImg(String(data.get('avatar_url')||''))||null};
  if(data.get('avatar_url')&&!obj.avatar_url)return notify('Avatar must use a valid HTTPS image URL.',true);
  await result(db.from('profiles').update(obj).eq('id',session.user.id));await refreshIdentity();notify('Profile updated.');return render();
 }
}

document.addEventListener('submit',async e=>{
 const form=e.target.closest('form[data-form]');if(!form)return;
 e.preventDefault();const button=e.submitter||form.querySelector('button[type=submit]');if(button)button.disabled=true;
 try{await handleForm(form,e);}catch(err){failure(err);}finally{if(button?.isConnected)button.disabled=false;}
});
document.addEventListener('click',async e=>{
 const el=e.target.closest('[data-action]');if(!el)return;
 e.preventDefault();if(el.disabled)return;
 el.disabled=true;try{await handleAction(el);}catch(err){failure(err);}finally{if(el.isConnected)el.disabled=false;}
});
window.addEventListener('hashchange',()=>render());

(async()=>{
 try{
  if(db){
   await refreshIdentity();
   db.auth.onAuthStateChange((event)=>{
    if(event==='PASSWORD_RECOVERY'){recovery=true;setTimeout(()=>goto('/reset'),30);return;}
    if(['SIGNED_IN','SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED'].includes(event)){
      setTimeout(async()=>{try{await refreshIdentity();if(event!=='TOKEN_REFRESHED'&&!recovery)await render();}catch(err){failure(err);}},0);
    }
   });
  }else updateHeader();
 }catch(err){failure(err);}finally{await render();}
})();
