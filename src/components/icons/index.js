/**
 * 图标库统一导出。
 *
 * 设计：单一 Icon.vue 内置全部 path 数据（24×24、currentColor、stroke），
 * 此处通过 h() 工厂为每个语义图标生成一个绑定好 name 的包装组件，
 * 既满足"逐个图标 SFC"的导入语义，又避免 22 份重复模板。
 *
 * 用法：
 *   import { IconChat, IconSend, Icon } from '@/components/icons'
 *   <IconChat :size="20" />
 *   <Icon name="lock" :size="16" />  // 通用形式
 */
import { h } from 'vue'
import Icon from './Icon.vue'

/** 全部可用图标 name（用于 TopologyView/SettingsPanel 等枚举场景） */
export const ICON_NAMES = [
  'chat',
  'announce',
  'pin',
  'doc',
  'file',
  'search',
  'settings',
  'video',
  'voice',
  'send',
  'back',
  'close',
  'menu',
  'copy',
  'check',
  'edit',
  'trash',
  'download',
  'image',
  'react',
  'thread',
  'lock',
  'leave',
  'topology',
  'plus',
  'user',
  'up',
  'down'
]

/** 工厂：为指定 name 生成一个包装组件，props 透传（size/class 等） */
function makeIcon(name) {
  return {
    name: 'Icon' + name.charAt(0).toUpperCase() + name.slice(1),
    props: { size: { type: [Number, String], default: 24 } },
    setup(props, { attrs }) {
      return () => h(Icon, { name, size: props.size, ...attrs })
    }
  }
}

export const IconChat = makeIcon('chat')
export const IconAnnounce = makeIcon('announce')
export const IconPin = makeIcon('pin')
export const IconDoc = makeIcon('doc')
export const IconFile = makeIcon('file')
export const IconSearch = makeIcon('search')
export const IconSettings = makeIcon('settings')
export const IconVideo = makeIcon('video')
export const IconVoice = makeIcon('voice')
export const IconSend = makeIcon('send')
export const IconBack = makeIcon('back')
export const IconClose = makeIcon('close')
export const IconMenu = makeIcon('menu')
export const IconCopy = makeIcon('copy')
export const IconCheck = makeIcon('check')
export const IconEdit = makeIcon('edit')
export const IconTrash = makeIcon('trash')
export const IconDownload = makeIcon('download')
export const IconImage = makeIcon('image')
export const IconReact = makeIcon('react')
export const IconThread = makeIcon('thread')
export const IconLock = makeIcon('lock')
export const IconLeave = makeIcon('leave')
export const IconTopology = makeIcon('topology')
export const IconPlus = makeIcon('plus')
export const IconUser = makeIcon('user')
export const IconUp = makeIcon('up')
export const IconDown = makeIcon('down')

export default Icon
