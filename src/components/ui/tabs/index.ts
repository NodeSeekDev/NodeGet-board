import { defineComponent, h, provide, inject, computed } from 'vue'
import { cn } from '@/lib/utils'

const TabsContext = Symbol('TabsContext')

export const Tabs = defineComponent({
  name: 'Tabs',
  props: {
    modelValue: { type: String, required: true },
    class: { type: String, default: '' },
  },
  emits: ['update:modelValue'],
  setup(props, { slots, emit }) {
    provide(TabsContext, computed({
      get: () => props.modelValue,
      set: (val) => emit('update:modelValue', val),
    }))

    return () => h('div', { class: props.class }, slots.default?.())
  },
})

export const TabsList = defineComponent({
  name: 'TabsList',
  props: {
    class: { type: String, default: '' },
  },
  setup(props, { slots }) {
    return () => h('div', {
      class: cn(
        'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
        props.class
      ),
    }, slots.default?.())
  },
})

export const TabsTrigger = defineComponent({
  name: 'TabsTrigger',
    props: {
        value: { type: String, required: true },
        class: { type: String, default: '' },
    },
    setup(props, { slots }) {
        const context = inject<{ value: string }>(TabsContext)

        return () => h('button', {
            type: 'button',
            class: cn(
                'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow',
                props.class
            ),
            'data-state': context?.value === props.value ? 'active' : 'inactive',
            onClick: () => {
                if (context) context.value = props.value
            },
        }, slots.default?.())
    },
})

export const TabsContent = defineComponent({
    name: 'TabsContent',
    props: {
        value: { type: String, required: true },
        class: { type: String, default: '' },
    },
    setup(props, { slots }) {
        const context = inject<{ value: string }>(TabsContext)

        return () => context?.value === props.value 
            ? h('div', {
                class: cn(
                    'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    props.class
                ),
            }, slots.default?.())
            : null
    },
})
