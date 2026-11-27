import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, BookOpen, Check,
  CheckCircle2, ChevronDown, Circle, Clock3, Code2, Command,
  FolderKanban, Github, LayoutDashboard, ListTodo, Plus, Search,
  Settings, Sparkles, Star, Trash2, X, ExternalLink, GitCommit,
  RefreshCw, AlertCircle, CalendarDays
} from 'lucide-react'
import { getInitialSession, hasSupabaseConfig, loadUserData, saveUserData, signInWithGitHub, signOut } from './supabase.js'

function today() { return new Date().toISOString().slice(0, 10) }

const navItems = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard, group: 'WORKSPACE' },
  { id: 'todo', label: '할 일 관리', icon: ListTodo, group: 'WORKSPACE' },
  { id: 'github', label: 'GitHub 활동', icon: Github, group: 'DEVELOPMENT' },
  { id: 'projects', label: '프로젝트', icon: FolderKanban, group: 'DEVELOPMENT' },
  { id: 'settings', label: '설정', icon: Settings, group: 'PREFERENCES' },
]

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [session, setSession] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authError, setAuthError] = useState('')
  const [dataReady, setDataReady] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [username, setUsername] = useState('')
  const [github, setGithub] = useState({ user: null, repos: [], events: [], loading: false, error: '' })
  const [contributions, setContributions] = useState({ totalContributions: 0, colors: [], weeks: [], loading: false, error: '' })
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!hasSupabaseConfig) { setAuthLoading(false); return }
    getInitialSession()
      .then(setSession)
      .catch(error => setAuthError(error.message || '로그인을 확인하지 못했습니다.'))
      .finally(() => setAuthLoading(false))
  }, [])

  useEffect(() => {
    if (!session?.user?.id) { setDataReady(false); return }
    let active = true
    setDataReady(false)
    setSyncError('')
    loadUserData(session.user.id).then(data => {
      if (!active) return
      setTasks(data?.tasks || [])
      setProjects(data?.projects || [])
      const githubName = data?.github_username || session.user.user_metadata?.user_name || session.user.user_metadata?.preferred_username || ''
      setUsername(githubName)
      setDataReady(true)
    }).catch(error => {
      if (active) setSyncError(error.message || '계정 데이터를 불러오지 못했습니다.')
    })
    return () => { active = false }
  }, [session])

  useEffect(() => {
    if (!session?.user?.id || !dataReady) return
    const timer = window.setTimeout(() => {
      saveUserData(session.user.id, { tasks, projects, github_username: username }).catch(error => setSyncError(error.message || '저장하지 못했습니다.'))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [session, dataReady, tasks, projects, username])

  const completed = tasks.filter(t => t.done).length
  const todayTasks = tasks.filter(t => t.dueDate === today())
  const filteredTasks = tasks.filter(t => t.title.toLowerCase().includes(query.toLowerCase()))
  const stats = useMemo(() => ({
    total: tasks.length, completed, remaining: tasks.length - completed,
    projects: projects.length
  }), [tasks, completed, projects])

  async function loadGithub(targetUsername = username) {
    if (!targetUsername.trim()) return
    setGithub(g => ({ ...g, loading: true, error: '' }))
    try {
      const headers = { Accept: 'application/vnd.github+json' }
      const [u, r, e] = await Promise.all([
        fetch(`https://api.github.com/users/${targetUsername}`, { headers }),
        fetch(`https://api.github.com/users/${targetUsername}/repos?sort=updated&per_page=6`, { headers }),
        fetch(`https://api.github.com/users/${targetUsername}/events/public?per_page=10`, { headers }),
      ])
      if (!u.ok) throw new Error(u.status === 404 ? 'GitHub 사용자를 찾을 수 없습니다.' : `GitHub API 오류 (${u.status})`)
      const user = await u.json()
      const repos = r.ok ? await r.json() : []
      const events = e.ok ? await e.json() : []
      setGithub({ user, repos, events, loading: false, error: '' })
    } catch (err) {
      setGithub(g => ({ ...g, loading: false, error: err.message || 'GitHub 데이터를 불러오지 못했습니다.' }))
    }
  }

  async function loadContributionCalendar(targetUsername = username) {
    if (!targetUsername.trim()) return
    setContributions({ totalContributions: 0, colors: [], weeks: [], loading: true, error: '' })
    try {
      const currentSession = await getInitialSession()
      if (!currentSession?.provider_token) {
        throw new Error('GitHub 기여 기록을 읽을 토큰이 없습니다. 설정에서 로그아웃한 뒤 GitHub로 다시 로그인해 주세요.')
      }

      const to = new Date()
      const from = new Date(to)
      from.setFullYear(to.getFullYear() - 1)
      const queryText = `query ContributionCalendar($login: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              totalContributions
              colors
              weeks { contributionDays { contributionCount date color } }
            }
          }
        }
      }`
      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${currentSession.provider_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: queryText,
          variables: { login: targetUsername, from: from.toISOString(), to: to.toISOString() },
        }),
      })
      const result = await response.json()
      if (!response.ok) {
        const message = response.status === 401
          ? 'GitHub 인증이 만료됐습니다. 설정에서 로그아웃한 뒤 다시 로그인해 주세요.'
          : `GitHub 기여 기록을 불러오지 못했습니다 (${response.status}).`
        throw new Error(message)
      }
      if (result.errors?.length) throw new Error(result.errors[0].message || 'GitHub 기여 기록을 불러오지 못했습니다.')
      const calendar = result.data?.user?.contributionsCollection?.contributionCalendar
      if (!calendar) throw new Error('GitHub 사용자의 기여 달력을 찾을 수 없습니다.')
      setContributions({ ...calendar, loading: false, error: '' })
    } catch (error) {
      setContributions(current => ({ ...current, loading: false, error: error.message || 'GitHub 기여 기록을 불러오지 못했습니다.' }))
    }
  }

  useEffect(() => {
    if (dataReady && username) {
      loadGithub(username)
      loadContributionCalendar(username)
    }
  }, [dataReady, username])

  function refreshGithubData() {
    loadGithub(username)
    loadContributionCalendar(username)
  }

  async function handleSignOut() {
    await signOut()
    setSession(null)
    setTasks([])
    setProjects([])
    setUsername('')
    setGithub({ user: null, repos: [], events: [], loading: false, error: '' })
    setContributions({ totalContributions: 0, colors: [], weeks: [], loading: false, error: '' })
  }

  if (!hasSupabaseConfig) return <LoginScreen configured={false} error={authError} />
  if (authLoading) return <LoginScreen loading />
  if (!session) return <LoginScreen error={authError} onSignIn={() => signInWithGitHub().catch(error => setAuthError(error.message))} />
  if (syncError && !dataReady) return <LoginScreen error={syncError} onSignOut={handleSignOut} />
  if (!dataReady) return <LoginScreen loading label="계정 데이터를 불러오는 중..." />

  function toggleTask(id) { setTasks(items => items.map(t => t.id === id ? { ...t, done: !t.done } : t)) }
  function addTask(task) { setTasks(items => [{ ...task, id: Date.now(), done: false }, ...items]) }
  function deleteTask(id) { setTasks(items => items.filter(t => t.id !== id)) }
  function addProject(project) { setProjects(items => [{ ...project, id: Date.now() }, ...items]) }
  function deleteProject(id) { setProjects(items => items.filter(p => p.id !== id)) }

  const title = navItems.find(n => n.id === page)?.label || '대시보드'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><Code2 size={21}/></div><div><b>DevFlow</b><span>PERSONAL WORKSPACE</span></div></div>
        <div className="workspace-switch"><div className="workspace-avatar">M</div><div><b>My Workspace</b><small>개인 개발 공간</small></div><ChevronDown size={15}/></div>
        {['WORKSPACE', 'DEVELOPMENT', 'PREFERENCES'].map(group => (
          <div className="nav-group" key={group}>
            <p className="nav-heading">{group}</p>
            {navItems.filter(n => n.group === group).map(item => {
              const Icon = item.icon
              return <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}><Icon size={18}/><span>{item.label}</span>{item.id === 'todo' && <em>{stats.remaining}</em>}</button>
            })}
          </div>
        ))}
        <div className="sidebar-bottom">
          <div className="tip-card"><Sparkles size={17}/><b>Keep building.</b><p>작은 작업도 꾸준히 쌓이면 큰 결과가 됩니다.</p></div>
          <div className="profile-row"><div className="profile-avatar">{(session.user.user_metadata?.user_name || username || 'GH').slice(0, 2).toUpperCase()}</div><div><b>{session.user.user_metadata?.full_name || username || 'GitHub 사용자'}</b><small>GitHub 계정</small></div></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span>/</span><b>{title}</b></div>
          <div className="top-actions"><div className="date-chip"><CalendarDays size={15}/>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}</div><button className="icon-button" title="알림"><Bell size={18}/></button></div>
        </header>
        <div className="page-content">
          {syncError && <div className="inline-error"><AlertCircle size={16}/>{syncError}</div>}
          {page === 'dashboard' && <Dashboard tasks={tasks} todayTasks={todayTasks} stats={stats} projects={projects} github={github} contributions={contributions} setPage={setPage} toggleTask={toggleTask}/>}
          {page === 'todo' && <TodoPage tasks={filteredTasks} allTasks={tasks} query={query} setQuery={setQuery} addTask={addTask} toggleTask={toggleTask} deleteTask={deleteTask}/>}
          {page === 'github' && <GithubPage github={github} contributions={contributions} username={username} setUsername={setUsername} onRefresh={refreshGithubData}/>}
          {page === 'projects' && <ProjectsPage projects={projects} addProject={addProject} deleteProject={deleteProject}/>}
          {page === 'settings' && <SettingsPage username={username} setUsername={setUsername} loadGithub={loadGithub} session={session} onSignOut={handleSignOut}/>}
        </div>
      </main>
    </div>
  )
}

function PageHeading({ eyebrow, title, description, action }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>
}
function Dashboard({ tasks, todayTasks, stats, projects, github, contributions, setPage, toggleTask }) {
  const percent = stats.total ? Math.round(stats.completed / stats.total * 100) : 0
  return <>
    <PageHeading eyebrow="OVERVIEW" title="좋은 하루야, 개발자님 👋" description="오늘의 작업과 개발 진행 상황을 확인해 보세요." action={<button className="primary-btn" onClick={() => setPage('todo')}><Plus size={17}/> 할 일 추가</button>}/>
    <div className="stat-grid">
      <StatCard label="전체 작업" value={stats.total} note="등록된 TODO" icon={ListTodo} color="purple"/>
      <StatCard label="완료한 작업" value={stats.completed} note="지금까지 완료" icon={CheckCircle2} color="green"/>
      <StatCard label="남은 작업" value={stats.remaining} note="완료가 필요한 작업" icon={Clock3} color="orange"/>
      <StatCard label="진행 중 프로젝트" value={stats.projects} note="관리 중인 프로젝트" icon={FolderKanban} color="blue"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel task-panel">
        <div className="panel-heading"><div><h2>오늘의 할 일</h2><p>오늘 처리해야 할 작업입니다.</p></div><button className="text-btn" onClick={() => setPage('todo')}>전체 보기 <ArrowUpRight size={15}/></button></div>
        <div className="progress-summary"><div><b>{todayTasks.filter(t => t.done).length} / {todayTasks.length}</b><span>완료</span></div><div className="progress-track"><div style={{ width: `${todayTasks.length ? todayTasks.filter(t => t.done).length / todayTasks.length * 100 : 0}%` }}/></div></div>
        <div className="task-list compact">{todayTasks.length ? todayTasks.map(t => <TaskRow key={t.id} task={t} toggleTask={toggleTask}/> ) : <Empty text="오늘 등록된 할 일이 없습니다."/>}</div>
      </section>
      <section className="panel progress-panel">
        <div className="panel-heading"><div><h2>작업 진행률</h2><p>전체 TODO 완료 현황</p></div><Activity size={19} className="muted-icon"/></div>
        <div className="donut-wrap"><div className="donut" style={{ '--progress': `${percent}%` }}><div><strong>{percent}%</strong><span>COMPLETED</span></div></div></div>
        <div className="legend"><span><i className="dot purple-dot"/>완료 <b>{stats.completed}</b></span><span><i className="dot gray-dot"/>남음 <b>{stats.remaining}</b></span></div>
      </section>
      <section className="panel projects-panel">
        <div className="panel-heading"><div><h2>내 프로젝트</h2><p>최근 관리 중인 프로젝트</p></div><button className="text-btn" onClick={() => setPage('projects')}>전체 보기 <ArrowUpRight size={15}/></button></div>
        <div className="project-mini-list">{projects.slice(0, 3).map(p => <div className="project-mini" key={p.id}><div className="project-icon" style={{ background: `${p.color}20`, color: p.color }}><Code2 size={18}/></div><div className="project-mini-info"><b>{p.name}</b><small>{p.description}</small><div className="mini-track"><span style={{ width: `${p.progress}%`, background: p.color }}/></div></div><strong>{p.progress}%</strong></div>)}</div>
      </section>
      <section className="panel contribution-panel">
        <div className="panel-heading"><div><h2>GitHub 일일 기여 기록</h2><p>최근 1년 · 커밋, 이슈, PR 등</p></div><strong className="contribution-total">{contributions.totalContributions} <span>contributions</span></strong></div>
        <ContributionCalendar calendar={contributions}/>
      </section>
      <section className="panel github-panel">
        <div className="panel-heading"><div><h2>GitHub 활동</h2><p>최근 공개 활동</p></div><button className="text-btn" onClick={() => setPage('github')}>GitHub 보기 <ArrowUpRight size={15}/></button></div>
        {github.loading ? <Empty text="GitHub 데이터를 불러오는 중입니다..."/> : github.error ? <div className="inline-error"><AlertCircle size={16}/>{github.error}</div> : github.events.slice(0, 4).map(ev => <EventRow key={ev.id} event={ev}/>)}
      </section>
    </div>
  </>
}
function StatCard({ label, value, note, icon: Icon, color }) {
  return <div className="stat-card"><div className={`stat-icon ${color}`}><Icon size={19}/></div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-note">{note}</div></div>
}
function TaskRow({ task, toggleTask, onDelete }) {
  return <div className={`task-row ${task.done ? 'is-done' : ''}`}><button className={`check-btn ${task.done ? 'checked' : ''}`} onClick={() => toggleTask(task.id)}>{task.done && <Check size={13}/>}</button><div className="task-info"><b>{task.title}</b><div className="task-meta"><span>{task.category}</span><i>·</i><span className={`priority ${task.priority}`}>{task.priority} 우선순위</span></div></div><span className="task-date">{task.dueDate}</span>{onDelete && <button className="subtle-icon" onClick={() => onDelete(task.id)} title="삭제"><Trash2 size={15}/></button>}</div>
}
function TodoPage({ tasks, allTasks, query, setQuery, addTask, toggleTask, deleteTask }) {
  const [showForm, setShowForm] = useState(false)
  const [filter, setFilter] = useState('전체')
  const [form, setForm] = useState({ title: '', category: '개발', priority: '보통', dueDate: today() })
  const visible = tasks.filter(t => filter === '전체' || (filter === '완료' ? t.done : !t.done))
  function submit(e) { e.preventDefault(); if (!form.title.trim()) return; addTask(form); setForm({ title: '', category: '개발', priority: '보통', dueDate: today() }); setShowForm(false) }
  return <>
    <PageHeading eyebrow="TASK MANAGEMENT" title="할 일 관리" description="해야 할 일을 기록하고 하나씩 완료해 보세요." action={<button className="primary-btn" onClick={() => setShowForm(!showForm)}><Plus size={17}/> 새 작업</button>}/>
    {showForm && <form className="panel task-form" onSubmit={submit}><div className="form-title"><h3>새 할 일 등록</h3><button type="button" className="subtle-icon" onClick={() => setShowForm(false)}><X size={17}/></button></div><input autoFocus placeholder="어떤 작업을 해야 하나요?" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/><div className="form-grid"><label>카테고리<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}><option>개발</option><option>공부</option><option>게임 개발</option><option>개인</option></select></label><label>우선순위<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}><option>높음</option><option>보통</option><option>낮음</option></select></label><label>마감일<input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}/></label></div><div className="form-actions"><button type="button" className="secondary-btn" onClick={() => setShowForm(false)}>취소</button><button className="primary-btn" type="submit"><Plus size={16}/> 등록하기</button></div></form>}
    <section className="panel todo-panel"><div className="todo-toolbar"><div className="filter-tabs">{['전체', '미완료', '완료'].map(f => <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>{f} {f === '전체' ? allTasks.length : f === '완료' ? allTasks.filter(t => t.done).length : allTasks.filter(t => !t.done).length}</button>)}</div><div className="search-box"><Search size={16}/><input placeholder="작업 검색..." value={query} onChange={e => setQuery(e.target.value)}/></div></div><div className="task-list">{visible.length ? visible.map(t => <TaskRow key={t.id} task={t} toggleTask={toggleTask} onDelete={deleteTask}/>) : <Empty text="표시할 작업이 없습니다."/>}</div></section>
  </>
}
function GithubPage({ github, contributions, username, setUsername, onRefresh }) {
  return <>
    <PageHeading eyebrow="DEVELOPER ACTIVITY" title="GitHub 활동" description="GitHub 프로필과 일일 기여도, 공개 Repository, 최근 활동을 확인합니다." action={<button className="secondary-btn" onClick={onRefresh}><RefreshCw size={16}/> 새로고침</button>}/>
    <section className="panel github-profile">
      <div className="github-avatar">{github.user?.avatar_url ? <img src={github.user.avatar_url} alt="GitHub avatar"/> : <Github size={34}/>}</div>
      <div className="github-user-info"><h2>{github.user?.name || username}</h2><a href={`https://github.com/${username}`} target="_blank" rel="noreferrer">@{username} <ExternalLink size={13}/></a><p>{github.user?.bio || 'GitHub 프로필 소개가 없습니다.'}</p></div>
      <div className="github-numbers"><div><b>{github.user?.public_repos ?? '-'}</b><span>Repositories</span></div><div><b>{github.user?.followers ?? '-'}</b><span>Followers</span></div><div><b>{github.user?.following ?? '-'}</b><span>Following</span></div></div>
    </section>
    {github.error && <div className="inline-error"><AlertCircle size={16}/>{github.error}</div>}
    {github.loading && <div className="panel"><Empty text="GitHub 데이터를 불러오는 중입니다..."/></div>}
    <section className="panel contribution-panel github-contribution-panel"><div className="panel-heading"><div><h2>일일 기여 기록</h2><p>최근 1년 · 커밋, 이슈, PR 등</p></div><strong className="contribution-total">{contributions.totalContributions} <span>contributions</span></strong></div><ContributionCalendar calendar={contributions}/></section>
    <div className="two-column">
      <section className="panel"><div className="panel-heading"><div><h2>최근 Repository</h2><p>최근 업데이트된 공개 저장소</p></div><Github size={18}/></div>{github.repos.length ? github.repos.map(repo => <div className="repo-row" key={repo.id}><div><b><a href={repo.html_url} target="_blank" rel="noreferrer">{repo.name} <ExternalLink size={12}/></a></b><p>{repo.description || '설명이 등록되지 않았습니다.'}</p><div className="repo-meta"><span><i className="language-dot"/> {repo.language || '언어 미지정'}</span><span><Star size={13}/> {repo.stargazers_count}</span><span><GitCommit size={13}/> {new Date(repo.updated_at).toLocaleDateString('ko-KR')}</span></div></div></div>) : !github.loading && <Empty text="Repository 데이터가 없습니다."/>}</section>
      <section className="panel"><div className="panel-heading"><div><h2>최근 활동</h2><p>GitHub 공개 이벤트</p></div><Activity size={18}/></div>{github.events.length ? github.events.map(ev => <EventRow key={ev.id} event={ev}/>) : !github.loading && <Empty text="최근 공개 활동이 없습니다."/>}</section>
    </div>
  </>
}
function ContributionCalendar({ calendar }) {
  if (calendar.loading && !calendar.weeks.length) return <Empty text="GitHub 기여 기록을 불러오는 중입니다..."/>
  if (calendar.error && !calendar.weeks.length) return <div className="contribution-error">{calendar.error}</div>
  if (!calendar.weeks.length) return <Empty text="표시할 GitHub 기여 기록이 없습니다."/>

  const months = calendar.weeks.map((week, index) => {
    const firstOfMonth = week.contributionDays.find(day => day.date.slice(-2) === '01')
    const date = firstOfMonth?.date || (index === 0 ? week.contributionDays[0]?.date : null)
    return date ? new Date(`${date}T00:00:00Z`).toLocaleDateString('ko-KR', { month: 'short', timeZone: 'UTC' }) : ''
  })
  return <div className="contribution-calendar">
    {calendar.error && <div className="contribution-error compact-error">{calendar.error}</div>}
    <div className="contribution-scroll">
      <div className="contribution-months"><div className="contribution-label-spacer"/>{months.map((month, index) => <span className="contribution-month" key={`${month}-${index}`}>{month}</span>)}</div>
      <div className="contribution-chart-row">
        <div className="contribution-weekdays"><span>월</span><span/><span>수</span><span/><span>금</span><span/><span/></div>
        <div className="contribution-weeks">{calendar.weeks.map((week, weekIndex) => {
          const daysByWeekday = Array(7).fill(null)
          week.contributionDays.forEach(day => {
            const weekday = new Date(`${day.date}T00:00:00Z`).getUTCDay()
            daysByWeekday[(weekday + 6) % 7] = day
          })
          return <div className="contribution-week" key={`${weekIndex}-${week.contributionDays[0]?.date || 'week'}`}>
            {daysByWeekday.map((day, dayIndex) => day
              ? <span className="contribution-day" key={day.date} title={`${day.date}: ${day.contributionCount} contributions`} style={{ backgroundColor: day.color || undefined }} aria-label={`${day.date}: ${day.contributionCount} contributions`}/>
              : <span className="contribution-day empty-day" key={`empty-${dayIndex}`} aria-hidden="true"/>)}
          </div>
        })}</div>
      </div>
    </div>
    <div className="contribution-legend"><span>Less</span><div className="legend-swatches">{(calendar.colors || []).map((color, index) => <span key={`${color}-${index}`} style={{ backgroundColor: color }}/>)}</div><span>More</span><span className="contribution-refresh-note">{calendar.loading ? '업데이트 중...' : 'GitHub 기여 합계'}</span></div>
  </div>
}
function EventRow({ event }) {
  const type = event.type === 'PushEvent' ? '코드 커밋' : event.type === 'CreateEvent' ? '생성' : event.type === 'PullRequestEvent' ? 'Pull Request' : event.type === 'IssuesEvent' ? 'Issue' : event.type.replace('Event', '')
  const detail = event.type === 'PushEvent' ? `${event.payload?.commits?.length || 0}개 커밋` : event.payload?.ref || event.payload?.action || ''
  return <div className="event-row"><div className="event-icon"><GitCommit size={16}/></div><div><b>{type}</b><p>{event.repo?.name} {detail && `· ${detail}`}</p><small>{new Date(event.created_at).toLocaleString('ko-KR')}</small></div></div>
}
function ProjectsPage({ projects, addProject, deleteProject }) {
  const [show, setShow] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', status: '진행 중', color: '#8b7cff', progress: 0 })
  function submit(e) { e.preventDefault(); if (!form.name.trim()) return; addProject(form); setForm({ name: '', description: '', status: '진행 중', color: '#8b7cff', progress: 0 }); setShow(false) }
  return <>
    <PageHeading eyebrow="PROJECT SPACE" title="프로젝트" description="개인 개발 프로젝트의 진행 상황을 관리합니다." action={<button className="primary-btn" onClick={() => setShow(!show)}><Plus size={17}/> 프로젝트 추가</button>}/>
    {show && <form className="panel task-form" onSubmit={submit}><div className="form-title"><h3>프로젝트 추가</h3><button type="button" className="subtle-icon" onClick={() => setShow(false)}><X size={17}/></button></div><input placeholder="프로젝트 이름" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/><input placeholder="프로젝트 설명" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/><div className="form-grid"><label>상태<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>진행 중</option><option>기획</option><option>보류</option><option>완료</option></select></label><label>진행률 (%)<input type="number" min="0" max="100" value={form.progress} onChange={e => setForm({ ...form, progress: Number(e.target.value) })}/></label></div><div className="form-actions"><button type="button" className="secondary-btn" onClick={() => setShow(false)}>취소</button><button className="primary-btn">등록하기</button></div></form>}
    <div className="project-grid">{projects.map(p => <div className="panel project-card" key={p.id}><div className="project-card-top"><div className="project-icon large" style={{ background: `${p.color}20`, color: p.color }}><FolderKanban size={22}/></div><button className="subtle-icon" onClick={() => deleteProject(p.id)} title="프로젝트 삭제"><Trash2 size={16}/></button></div><span className="status-pill">{p.status}</span><h3>{p.name}</h3><p>{p.description}</p><div className="project-progress-label"><span>진행률</span><b>{p.progress}%</b></div><div className="progress-track"><div style={{ width: `${p.progress}%`, background: p.color }}/></div></div>)}</div>
    {!projects.length && <div className="panel"><Empty text="등록된 프로젝트가 없습니다."/></div>}
  </>
}
function SettingsPage({ username, setUsername, loadGithub, session, onSignOut }) {
  const [draft, setDraft] = useState(username)
  return <>
    <PageHeading eyebrow="PREFERENCES" title="설정" description="DevFlow의 기본 설정을 관리합니다."/>
    <section className="panel settings-panel"><div className="panel-heading"><div><h2>GitHub 연결</h2><p>공개 프로필과 Repository를 불러올 계정입니다.</p></div><Github size={20}/></div><label className="field-label">GitHub 사용자명</label><div className="settings-input-row"><div className="input-prefix">@</div><input value={draft} onChange={e => setDraft(e.target.value)} placeholder="GitHub username"/><button className="primary-btn" onClick={() => { setUsername(draft.trim()); loadGithub(draft.trim()) }}>저장 및 연결</button></div><p className="helper-text">현재는 공개 데이터만 조회합니다. 비공개 Repository 접근에는 별도의 안전한 인증 구성이 필요합니다.</p></section>
    <section className="panel settings-panel"><div className="panel-heading"><div><h2>계정 및 데이터</h2><p>로그인한 GitHub 계정에 연결된 데이터입니다.</p></div><BookOpen size={20}/></div><div className="storage-note"><CheckCircle2 size={18}/><div><b>{session.user.user_metadata?.full_name || username || session.user.email}</b><p>TODO와 프로젝트는 Supabase에 계정별로 저장되며, 다른 기기에서 로그인해도 동기화됩니다.</p></div></div><button className="secondary-btn settings-signout" onClick={onSignOut}>GitHub 로그아웃</button></section>
  </>
}
function LoginScreen({ configured = true, loading = false, error = '', onSignIn, onSignOut, label = '로그인 확인 중...' }) {
  return <main className="login-shell"><section className="login-card">
    <div className="brand-mark login-mark"><Code2 size={22}/></div>
    <div className="eyebrow">PERSONAL DEVELOPER WORKSPACE</div>
    <h1>DevFlow</h1>
    {!configured ? <>
      <p>개인별 로그인을 시작하려면 Supabase 설정이 필요합니다.</p>
      <div className="login-setup"><b>필요한 설정</b><span>Supabase 프로젝트와 GitHub 로그인 제공자를 만들고, GitHub Actions 변수에 프로젝트 URL과 공개 키를 등록하세요.</span><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_ANON_KEY</code></div>
    </> : loading ? <p>{label}</p> : <>
      <p>GitHub 계정으로 로그인하면 나만의 TODO와 프로젝트를 관리할 수 있어요.</p>
      {error && <div className="inline-error"><AlertCircle size={16}/>{error}</div>}
      {onSignIn && <button className="primary-btn login-button" onClick={onSignIn}><Github size={18}/> GitHub로 로그인</button>}
      {onSignOut && <button className="secondary-btn login-button" onClick={onSignOut}>로그아웃 후 다시 시도</button>}
      <small>각 계정의 데이터는 분리되어 저장됩니다.</small>
    </>}
  </section></main>
}
function Empty({ text }) { return <div className="empty-state"><div><Circle size={20}/></div><p>{text}</p></div> }
